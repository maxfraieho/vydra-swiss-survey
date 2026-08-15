"""Minimal Chrome DevTools Protocol client for the survey agent.

Talks directly to CDP over a self-healing SSH tunnel to the Windows
laptop (192.168.3.30) — same pattern as rpi3b's ~/bin/chrome-win-mcp.sh,
just reimplemented in Python so this repo has no Node dependency on the
phone. The laptop's CDP ports (9224 Swiss Perplexity, 9225 Swiss Survey
Browser) are deliberately NOT opened in the Windows firewall (see
browser-harness-windows.md's zero-trust design — only the supergateway
SSE bridge ports are LAN-exposed) so a tunnel is required, not optional.

Click targeting is deterministic, not vision-guessed: find_and_click()
runs a JS text search over the DOM and computes the element's bounding
box center itself. Gemma only ever says WHAT to click (see vision.py),
never WHERE — TASK-65's lesson (a 4B vision model can't invent good
pixel coordinates) applies here just as much as it did to agent_editor.py.
"""
from __future__ import annotations

import base64
import itertools
import json
import os
import re
import subprocess
import time
import unicodedata

import requests
from websocket import create_connection

import persona_graph_memory

SSH_USER = "vokov"
SSH_PASS = os.environ.get("SWISS_LAPTOP_SSH_PASS", "0523")


class CDPError(RuntimeError):
    pass


def ensure_tunnel(ssh_host: str, remote_port: int, local_port: int, wait_seconds: float = 8.0) -> int:
    """Self-heal SSH tunnel from `local_port` to `ssh_host`:`remote_port`.
    Only used for kind='direct_cdp' browser_sources — mcp_bridge sources are
    LAN-reachable directly and never go through this."""
    if ssh_host in ("127.0.0.1", "localhost"):
        try:
            r = requests.get(f"http://127.0.0.1:{remote_port}/json/version", timeout=1.0)
            if r.ok:
                return remote_port
        except requests.RequestException:
            pass

    try:
        r = requests.get(f"http://127.0.0.1:{local_port}/json/version", timeout=0.5)
        if r.ok:
            return remote_port
    except requests.RequestException:
        pass

    subprocess.run(
        ["pkill", "-f", f"ssh .*-L {local_port}:127.0.0.1:"],
        capture_output=True,
    )
    time.sleep(0.2)

    subprocess.Popen(
        ["sshpass", "-p", SSH_PASS, "ssh", "-o", "StrictHostKeyChecking=no",
         "-L", f"{local_port}:localhost:{remote_port}",
         "-R", "5005:localhost:5005",
         "-R", "5173:localhost:5173",
         f"{SSH_USER}@{ssh_host}", "-N"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        try:
            r = requests.get(f"http://127.0.0.1:{local_port}/json/version", timeout=0.5)
            if r.ok:
                return remote_port
        except requests.RequestException:
            pass
        time.sleep(0.2)

    raise CDPError(f"Tunnel to {ssh_host}:{remote_port} via {local_port} did not come up "
                    f"in {wait_seconds}s — is the browser running on {ssh_host}?")


_SURVEY_DOMAIN_HINTS = ("meinungsplatz", "bilendi", "survey", "gfk", "maximiles", "cinode", "opinion", "mriweb")


class CDPClient:
    def __init__(self, local_port: int, cdp_target_key: str | None = None):
        """Resolves CDP target from active `browser_sources` in priority order.
        If the primary source fails/times out, it attempts fallback sources sequentially
        before raising a unified CDPError."""
        if cdp_target_key:
            source = persona_graph_memory.get_browser_source_by_key(cdp_target_key)
            sources = [source] if source else []
            if not sources:
                raise CDPError(f"No browser_source with key={cdp_target_key!r} found (Settings → Браузер)")
        else:
            sources = persona_graph_memory.get_active_browser_sources()
            if not sources:
                raise CDPError("No active browser_sources configured — set them via Settings → Браузер")

        self.base = None
        self.active_source = None
        errors = []

        for src in sources:
            try:
                if src["kind"] == "direct_cdp":
                    if src["host"] in ("127.0.0.1", "localhost"):
                        self.base = f"http://127.0.0.1:{src['port']}"
                    else:
                        ensure_tunnel(src["host"], src["port"], local_port)
                        self.base = f"http://127.0.0.1:{local_port}"
                    self.active_source = src
                    break
                elif src["kind"] == "mcp_bridge":
                    r = requests.get(f"http://{src['host']}:{src['port']}/", timeout=3)
                    self.base = f"http://{src['host']}:{src['port']}"
                    self.active_source = src
                    break
                else:
                    errors.append(f"Source '{src['label']}': Unknown kind {src['kind']!r}")
            except Exception as e:
                err_msg = f"Source '{src['label']}' ({src['host']}:{src['port']}) failed: {e}"
                print(f"⚠️ Primary/fallback browser source unavailable: {err_msg}")
                errors.append(err_msg)

        if not self.base:
            raise CDPError(
                f"All configured active browser sources in fallback chain failed! Errors: {'; '.join(errors)}"
            )

        self._ids = itertools.count(1)
        self.ws = None
        self.target_id = None
        self.opened_target_ids: set[str] = set()

    def attach_or_open_tab(self, url: str) -> bool:
        """Attaches to an existing active tab matching the domain if present,
        otherwise opens a new tab. Returns True if attached to an existing tab."""
        try:
            r = requests.get(f"{self.base}/json/list", timeout=5)
            if r.ok:
                tabs = [t for t in r.json() if t.get("type") == "page"]
                target_host = url.split("//", 1)[-1].split("/", 1)[0].replace("www.", "")
                # First check exact host match
                matched = [t for t in tabs if target_host in t.get("url", "")]
                # Otherwise check general survey domain matches or any active page tab
                if not matched:
                    matched = [t for t in tabs if any(d in t.get("url", "").lower() for d in _SURVEY_DOMAIN_HINTS)]
                # No blind tabs[-1] fallback here on purpose: grabbing an
                # unrelated tab (e.g. someone's Perplexity/manual browsing
                # tab in the shared CDP pool) hijacks it instead of opening
                # a fresh one — worse than the extra tab.
                if matched:
                    t = matched[-1]
                    ws_url = t["webSocketDebuggerUrl"]
                    self.target_id = t["id"]
                    self.opened_target_ids.add(self.target_id)
                    self.ws = create_connection(ws_url, timeout=30)
                    self._send("Page.enable")
                    self._send("Runtime.enable")
                    self._send("DOM.enable")
                    self._send("Page.bringToFront")
                    self._inject_stealth_anti_bot_overrides()
                    self._prune_stray_tabs()
                    return True
        except Exception:
            pass
        self.open_tab(url)
        self._prune_stray_tabs()
        return False

    def attach_exact_tab(self, url: str) -> bool:
        """Attaches to a tab whose URL matches `url` exactly or as a substring
        (handles trailing query-param drift on the same page). Raises CDPError
        if no matching tab is found — no blind fallback to opening a new tab or
        grabbing an unrelated one, per this file's existing convention (see
        attach_or_open_tab's no-fallback comment above)."""
        r = requests.get(f"{self.base}/json/list", timeout=5)
        r.raise_for_status()
        tabs = [t for t in r.json() if t.get("type") == "page"]
        matched = [t for t in tabs if t.get("url") == url] or [t for t in tabs if url in t.get("url", "")]
        if not matched:
            raise CDPError(f"No open tab matches URL: {url!r}. Open it manually first, then retry.")
        t = matched[-1]
        ws_url = t["webSocketDebuggerUrl"]
        self.target_id = t["id"]
        self.ws = create_connection(ws_url, timeout=30)
        self._send("Page.enable")
        self._send("Runtime.enable")
        self._send("DOM.enable")
        self._send("Page.bringToFront")
    def check_and_attach_new_tab(self) -> str | None:
        """Checks if a new page tab was opened by a click action and switches target_id to it.
        Returns the new URL if switched, or None if no new tab was detected."""
        try:
            r = requests.get(f"{self.base}/json/list", timeout=3)
            if not r.ok:
                return None
            tabs = [t for t in r.json() if t.get("type") == "page"]
            for t in reversed(tabs):
                if t.get("id") != self.target_id:
                    ws_url = t.get("webSocketDebuggerUrl")
                    if ws_url:
                        self.target_id = t["id"]
                        self.opened_target_ids.add(self.target_id)
                        self.ws = create_connection(ws_url, timeout=30)
                        self._send("Page.enable")
                        self._send("Runtime.enable")
                        self._send("DOM.enable")
                        self._send("Page.bringToFront")
                        self._inject_stealth_anti_bot_overrides()
                        new_url = self.get_current_url()
                        return new_url
        except Exception:
            pass
        return None

    def _inject_stealth_anti_bot_overrides(self) -> None:
        stealth_js = r"""
        (function() {
            try {
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            } catch(e) {}
            try {
                if (!window.chrome) window.chrome = {};
                if (!window.chrome.runtime) window.chrome.runtime = {};
            } catch(e) {}
            try {
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            } catch(e) {}
            try {
                Object.defineProperty(navigator, 'languages', {get: () => ['de-CH', 'de', 'fr-CH', 'en-US']});
            } catch(e) {}
        })()
        """
        try:
            self._send("Page.addScriptToEvaluateOnNewDocument", {"source": stealth_js})
            self._send("Runtime.evaluate", {"expression": stealth_js})
        except Exception:
            pass


    def _prune_stray_tabs(self) -> None:
        """Disabled tab auto-pruning to preserve all user open tabs."""
        return

    def open_tab(self, url: str) -> None:
        try:
            r = requests.put(f"{self.base}/json/new?{url}", timeout=10)
            if not r.ok:
                raise requests.RequestException(f"status {r.status_code}")
        except requests.RequestException:
            r = requests.get(f"{self.base}/json/new?{url}", timeout=10)
            r.raise_for_status()
        target = r.json()
        ws_url = target["webSocketDebuggerUrl"]
        self.target_id = target["id"]
        self.opened_target_ids.add(self.target_id)
        self.ws = create_connection(ws_url, timeout=30)
        self._send("Page.enable")
        self._send("Runtime.enable")
        self._send("DOM.enable")
        self._send("Page.bringToFront")

    def get_current_url(self) -> str:
        try:
            res = self._send("Runtime.evaluate", {"expression": "location.href", "returnByValue": True})
            return str(res.get("result", {}).get("value") or "")
        except Exception:
            return ""

    def page_text(self, limit: int = 2000) -> str:
        """document.body.innerText, обрізаний до limit символів. При помилці -> ''."""
        try:
            res = self._send("Runtime.evaluate", {"expression": "document.body.innerText || ''", "returnByValue": True})
            result = res.get("result", {}).get("value") or ""
            return str(result)[:limit]
        except Exception:
            return ""

    def _send(self, method: str, params: dict | None = None, timeout: float = 30.0) -> dict:
        msg_id = next(self._ids)
        self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.ws.settimeout(max(0.1, deadline - time.time()))
            raw = self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == msg_id:
                if "error" in data:
                    raise CDPError(f"{method} failed: {data['error']}")
                return data.get("result", {})
            # else: an unrelated event notification — ignore and keep waiting
        raise CDPError(f"{method} timed out waiting for response")

    def navigate(self, url: str) -> None:
        self._send("Page.navigate", {"url": url})
        deadline = time.time() + 10.0
        ready = False
        while time.time() < deadline:
            try:
                r = self._send("Runtime.evaluate", {"expression": "document.readyState", "returnByValue": True}, timeout=2.0)
                if r.get("result", {}).get("value") == "complete":
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.3)
        time.sleep(1.0 if ready else 2.0)  # settle time even after 'complete' for async CMP/consent modals

    def screenshot(self, path: str) -> str:
        self._send("Page.bringToFront")
        time.sleep(0.3)
        result = self._send("Page.captureScreenshot", {"format": "png"})
        png_bytes = base64.b64decode(result["data"])
        with open(path, "wb") as f:
            f.write(png_bytes)
        return path

    _FIND_JS = r"""
(function(needle) {
  needle = needle.trim().toLowerCase();

  function clean(str) {
    return (str || '').toLowerCase().replace(/[º°n]/g, ' ').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function matches(t, needle) {
    if (!t) return false;
    var tLow = t.trim().toLowerCase();
    var nLow = needle.toLowerCase();
    if (tLow === nLow) return true;
    if (tLow.indexOf(nLow) !== -1) return true;
    var ct = clean(t), cn = clean(needle);
    if (cn && (ct === cn || ct.indexOf(cn) !== -1)) return true;
    var digits = nLow.replace(/[^0-9]/g, '');
    if (digits.length >= 4 && (tLow.indexOf(digits) !== -1 || clean(t).indexOf(digits) !== -1)) return true;
    return false;
  }

  function textOf(el) {
    return (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-value') || el.getAttribute('placeholder') || '').trim();
  }

  function isVisible(el) {
    if (el.offsetParent === null && el.tagName !== 'BODY') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  var selectors = 'button, input[type="radio"], input[type="checkbox"], input[type="submit"], input[type="button"], label, [role="button"], [role="radio"], [role="option"], [class*="option"], [class*="choice"], [class*="radio"], [class*="scale"], [class*="sondage"], [class*="survey"], [class*="card"], a.btn, a[class*="button"], a[href], td, li, span, div';
  var els = Array.from(document.querySelectorAll(selectors)).filter(isVisible);

  for (var i = 0; i < els.length; i++) {
    var b = els[i];
    var t = textOf(b);
    if (t && t.toLowerCase() === needle) {
      var r = (b.parentElement && b.tagName === "INPUT") ? b.parentElement.getBoundingClientRect() : b.getBoundingClientRect();
      return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2, tag: b.tagName, text: t.slice(0, 60)});
    }
  }

  for (var i = 0; i < els.length; i++) {
    var b = els[i];
    var t = textOf(b);
    if (t && matches(t, needle)) {
      var r = (b.parentElement && b.tagName === "INPUT") ? b.parentElement.getBoundingClientRect() : b.getBoundingClientRect();
      return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2, tag: b.tagName, text: t.slice(0, 60)});
    }
  }

  var all = Array.from(document.querySelectorAll('*')).filter(isVisible);
  var best = null, bestArea = Infinity;
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var t = textOf(el);
    if (!t) continue;
    if (matches(t, needle)) {
      var r = el.getBoundingClientRect();
      var area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = {x: r.x + r.width / 2, y: r.y + r.height / 2, tag: el.tagName, text: t.slice(0, 60)};
      }
    }
  }
  return best ? JSON.stringify(best) : "null";
})(%s)
"""

    _FIND_SUBMIT_JS = r"""
(function() {
  function isVisible(el) {
    if (el.offsetParent === null && el.tagName !== 'BODY') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  var selectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button.next', '.btn-next', '.next-button', '.btn-submit',
    '[id*="next"]', '[id*="submit"]', '[class*="next"]', '[class*="submit"]',
    'button', 'a.btn'
  ];

  for (var s = 0; s < selectors.length; s++) {
    var els = Array.from(document.querySelectorAll(selectors[s])).filter(isVisible);
    if (els.length > 0) {
      var b = els[els.length - 1]; // usually the bottom-most submit button in survey form
      var r = b.getBoundingClientRect();
      var t = b.innerText || b.value || b.getAttribute('aria-label') || b.tagName;
      return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2, tag: b.tagName, text: (t || '').slice(0, 60)});
    }
  }
  return "null";
})()
"""

    _GET_BOUNDING_BOXES_JS = r"""
(function() {
  function isVisible(el) {
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  var vw = window.innerWidth || document.documentElement.clientWidth || 1;
  var vh = window.innerHeight || document.documentElement.clientHeight || 1;
  var els = Array.from(document.querySelectorAll('button, input, label, select')).filter(isVisible);
  var boxes = [];
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var r = el.getBoundingClientRect();
    var text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
    boxes.push({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      text: text.slice(0, 60),
      x: Math.round((r.left / vw) * 10000) / 100,
      y: Math.round((r.top / vh) * 10000) / 100,
      width: Math.round((r.width / vw) * 10000) / 100,
      height: Math.round((r.height / vh) * 10000) / 100
    });
  }
  return JSON.stringify(boxes);
})()
"""


    def find_element(self, text: str) -> dict | None:
        clean_text = text
        contains_match = re.search(r':contains\(["\'](.*?)["\']\)', text, re.IGNORECASE)
        if contains_match:
            clean_text = contains_match.group(1)

        js = self._FIND_JS % json.dumps(clean_text)
        result = self._send("Runtime.evaluate", {"expression": js, "returnByValue": True})
        value = result.get("result", {}).get("value")
        if value and value != "null":
            return json.loads(value)

        # Fallback CSS selector query if text contains selector syntax
        if any(char in text for char in ("#", ".", "[", "]", ">")):
            try:
                selector_js = f"""(function() {{
                    var el = document.querySelector({json.dumps(text)});
                    if (!el) return 'null';
                    var r = el.getBoundingClientRect();
                    return JSON.stringify({{x: r.x + r.width / 2, y: r.y + r.height / 2, tag: el.tagName, text: (el.innerText || '').slice(0, 60)}});
                }})()"""
                sel_res = self._send("Runtime.evaluate", {"expression": selector_js, "returnByValue": True})
                sel_val = sel_res.get("result", {}).get("value")
                if sel_val and sel_val != "null":
                    return json.loads(sel_val)
            except Exception:
                pass

        return None

    def find_submit_button(self) -> dict | None:
        result = self._send("Runtime.evaluate", {"expression": self._FIND_SUBMIT_JS, "returnByValue": True})
        value = result.get("result", {}).get("value")
        if not value or value == "null":
            return None
        return json.loads(value)

    def click_by_text(self, text: str) -> bool:
        import random
        el = self.find_element(text)
        if el is None:
            # Fallback for common survey continuation/next buttons across French/German/English
            target_lower = text.strip().lower()
            synonyms = ["continuer", "suivant", "next", "weiter", "fortfahren", "envoyer", "valider", "submit", "ок"]
            if target_lower in synonyms:
                for syn in synonyms:
                    if syn != target_lower:
                        el = self.find_element(syn)
                        if el is not None:
                            break
                if el is None:
                    el = self.find_submit_button()
        if el is None:
            return False
        
        # Human reading/thinking delay before click
        time.sleep(random.uniform(0.4, 1.1))

        # Add Gaussian coordinate offset jitter (+-10% of element size)
        x = el["x"] + random.uniform(-4.0, 4.0)
        y = el["y"] + random.uniform(-3.0, 3.0)

        # Humanized mouse movement: hover before press
        self._send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        time.sleep(random.uniform(0.08, 0.22))

        # Mouse press hold delay
        self._send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y,
                                                  "button": "left", "clickCount": 1})
        time.sleep(random.uniform(0.05, 0.15))
        self._send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y,
                                                  "button": "left", "clickCount": 1})
        return True

    def type_text(self, text: str) -> None:
        import random
        self._send("Runtime.evaluate", {
            "expression": "(function(){var e=document.activeElement;"
                          "if(e&&typeof e.select==='function'){e.select();}})()"
        })
        time.sleep(random.uniform(0.2, 0.4))
        # Char-by-char typing with natural human inter-keystroke delays
        for char in text:
            self._send("Input.insertText", {"text": char})
            time.sleep(random.uniform(0.04, 0.12))

    def scroll(self, dy: int = 400) -> None:
        self._send("Input.dispatchMouseEvent", {
            "type": "mouseWheel", "x": 400, "y": 400,
            "deltaX": 0, "deltaY": dy,
        })

    def get_interactive_bounding_boxes(self) -> list[dict]:
        try:
            res = self._send("Runtime.evaluate", {"expression": self._GET_BOUNDING_BOXES_JS, "returnByValue": True})
            val = res.get("result", {}).get("value")
            if val:
                return json.loads(val) if isinstance(val, str) else val
        except Exception:
            pass
        return []

    def detect_captcha_signatures(self) -> list[str]:
        js = r"""(function() {
            var html = document.documentElement ? document.documentElement.innerHTML.toLowerCase() : '';
            var sigs = ['cf-turnstile', 'g-recaptcha', 'hcaptcha', 'geetest'];
            return JSON.stringify(sigs.filter(function(s) { return html.indexOf(s) !== -1; }));
        })()"""
        try:
            res = self._send("Runtime.evaluate", {"expression": js, "returnByValue": True})
            val = res.get("result", {}).get("value")
            if val:
                return json.loads(val) if isinstance(val, str) else val
        except Exception:
            pass
        return []


    def close(self, close_tabs: bool = False) -> None:
        """Close WebSocket connection. Preserves Chrome tabs unless close_tabs=True is explicitly passed."""
        if self.ws is not None:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None

        if close_tabs:
            targets_to_close = set(self.opened_target_ids)
            if self.target_id:
                targets_to_close.add(self.target_id)
            for tid in targets_to_close:
                try:
                    requests.get(f"{self.base}/json/close/{tid}", timeout=5)
                except Exception:
                    pass

        self.target_id = None
        self.opened_target_ids.clear()


def normalize_survey_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\xa0", " ")
    umlaut_map = {
        "ä": "ae", "ö": "oe", "ü": "ue",
        "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
        "ß": "ss"
    }
    for char, replacement in umlaut_map.items():
        text = text.replace(char, replacement)
    normalized = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    cleaned = re.sub(r"[^\w\s]", " ", stripped).lower()
    return re.sub(r"\s+", " ", cleaned).strip()


def match_survey_text(target: str, candidate: str) -> bool:
    norm_target = normalize_survey_text(target)
    norm_candidate = normalize_survey_text(candidate)
    if not norm_target or not norm_candidate:
        return False
    if norm_target == norm_candidate:
        return True
    short_guard_tokens = {"oui", "non", "ja", "nein"}
    if len(norm_target) <= 3 or len(norm_candidate) <= 3 or norm_target in short_guard_tokens or norm_candidate in short_guard_tokens:
        return norm_target == norm_candidate
    return norm_target in norm_candidate or norm_candidate in norm_target

