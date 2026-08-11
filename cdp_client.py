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
         "-L", f"{local_port}:127.0.0.1:{remote_port}",
         f"{SSH_USER}@{ssh_host}", "-N"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
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
        """Resolves its CDP target from `browser_sources` (Settings → Браузер)
        instead of a hardcoded host. `cdp_target_key`, if given, overrides the
        active row for this run only (does not change which row is active).
        No fallback to any other browser on failure — fails loud instead, per
        product requirement: an unreachable target means report the problem,
        not improvise a substitute browser session."""
        if cdp_target_key:
            source = persona_graph_memory.get_browser_source_by_key(cdp_target_key)
            if source is None:
                raise CDPError(f"No browser_source with key={cdp_target_key!r} found "
                                f"(Settings → Браузер)")
        else:
            source = persona_graph_memory.get_active_browser_source()
            if source is None:
                raise CDPError("No active browser_source configured — set one via Settings → Браузер")

        if source["kind"] == "direct_cdp":
            ensure_tunnel(source["host"], source["port"], local_port)
            self.base = f"http://127.0.0.1:{local_port}"
        elif source["kind"] == "mcp_bridge":
            try:
                r = requests.get(f"http://{source['host']}:{source['port']}/json/version", timeout=3)
                r.raise_for_status()
            except Exception as e:
                raise CDPError(
                    f"Active browser_source '{source['label']}' ({source['host']}:{source['port']}) "
                    f"is unreachable: {e}. It may not have started yet or crashed — do not fall back "
                    f"to a substitute browser. Wait/retry, or report this."
                ) from e
            self.base = f"http://{source['host']}:{source['port']}"
        else:
            raise CDPError(f"Unknown browser_source kind: {source['kind']!r}")

        self._ids = itertools.count(1)
        self.ws = None
        self.target_id = None

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
                    self.ws = create_connection(ws_url, timeout=30)
                    self._send("Page.enable")
                    self._send("Runtime.enable")
                    self._send("DOM.enable")
                    self._send("Page.bringToFront")
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
        self._prune_stray_tabs()
        return True


    def _prune_stray_tabs(self) -> None:
        """Closes leftover survey-domain tabs from crashed prior runs (a run
        that got SIGKILLed/OOM-killed skips its `finally: client.close()`,
        leaving its tab open) so tab count never grows unbounded. Keeps only
        self.target_id — the tab this instance is currently using."""
        try:
            r = requests.get(f"{self.base}/json/list", timeout=5)
            if not r.ok:
                return
            for t in r.json():
                if t.get("type") != "page" or t.get("id") == self.target_id:
                    continue
                if any(d in t.get("url", "").lower() for d in _SURVEY_DOMAIN_HINTS):
                    try:
                        requests.get(f"{self.base}/json/close/{t['id']}", timeout=5)
                    except Exception:
                        pass
        except Exception:
            pass

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
        x, y = el["x"], el["y"]
        self._send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        self._send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y,
                                                  "button": "left", "clickCount": 1})
        self._send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y,
                                                  "button": "left", "clickCount": 1})
        return True

    def type_text(self, text: str) -> None:
        # Best-effort: assumes a field was already focused by a prior
        # click_by_text() call on its label/placeholder. Select-all first -
        # confirmed live 2026-07-27 that a pre-filled/autofilled field (e.g.
        # a remembered email address) gets Input.insertText APPENDED to its
        # existing value rather than replacing it, corrupting the field.
        self._send("Runtime.evaluate", {
            "expression": "(function(){var e=document.activeElement;"
                          "if(e&&typeof e.select==='function'){e.select();}})()"
        })
        self._send("Input.insertText", {"text": text})

    def scroll(self, dy: int = 400) -> None:
        self._send("Input.dispatchMouseEvent", {
            "type": "mouseWheel", "x": 400, "y": 400,
            "deltaX": 0, "deltaY": dy,
        })

    def close(self) -> None:
        if self.ws is not None:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None
        # Actually close the Chrome tab, not just the debugger connection —
        # leaving self.ws=None but the tab open leaks a tab per run and
        # starves this 2-core host's CPU (each open tab keeps a live
        # renderer process; a handful of stale tabs was enough to push
        # host load average to 6+ and stall unrelated work).
        if self.target_id is not None:
            try:
                requests.get(f"{self.base}/json/close/{self.target_id}", timeout=5)
            except Exception:
                pass
            self.target_id = None


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

