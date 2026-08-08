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
import subprocess
import time

import requests
from websocket import create_connection

SSH_HOST = "192.168.3.184"  # laptop, LAN IP - the Tailscale IP (100.68.179.102) this
# used to point at is unreachable from this phone now (no `tailscale` CLI/VPN active
# in Termux; SSH to it times out), while the LAN IP answers SSH immediately. Switched
# 2026-07-27 after confirming both empirically.
SSH_USER = "vokov"
SSH_PASS = "0523"

# port -> which isolated Swiss-proxied Chrome window on the laptop
REMOTE_PORTS = {
    "survey": 9226,   # Swiss Survey Browser.bat (port 9224)
    "perplexity": 9224,  # Swiss Perplexity.bat
    "survey_legacy": 9225,
}


class CDPError(RuntimeError):
    pass


def ensure_tunnel(remote_port: int, local_port: int, wait_seconds: float = 8.0) -> int:
    try:
        r = requests.get("http://192.168.3.184:9226/json/version", timeout=1.0)
        if r.ok:
            return 9226
    except Exception:
        pass
    """Self-heal SSH tunnel: reuse if already up, otherwise auto-detect
    active Chrome CDP port on laptop (9225 or 9224) and bring up SSH tunnel."""
    try:
        r = requests.get(f"http://127.0.0.1:{local_port}/json/version", timeout=0.5)
        if r.ok:
            return remote_port
    except requests.RequestException:
        pass

    ports_to_try = [remote_port] + [p for p in (9226, 9225, 9224) if p != remote_port]
    for rport in ports_to_try:
        subprocess.run(
            ["pkill", "-f", f"ssh .*-L {local_port}:127.0.0.1:"],
            capture_output=True,
        )
        time.sleep(0.2)

        subprocess.Popen(
            ["sshpass", "-p", SSH_PASS, "ssh", "-o", "StrictHostKeyChecking=no",
             "-L", f"{local_port}:127.0.0.1:{rport}",
             f"{SSH_USER}@{SSH_HOST}", "-N"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        deadline = time.time() + 3.0
        while time.time() < deadline:
            try:
                r = requests.get(f"http://127.0.0.1:{local_port}/json/version", timeout=0.5)
                if r.ok:
                    return rport
            except requests.RequestException:
                pass
            time.sleep(0.2)

    raise CDPError(f"Tunnel to laptop:{remote_port} (or fallback 9225/9224) via {local_port} did not come up "
                    f"in {wait_seconds}s — is the corresponding .bat running on the laptop?")


class CDPClient:
    def __init__(self, local_port: int):
        self.base = f"http://192.168.3.184:9226"
        self._ids = itertools.count(1)
        self.ws = None

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
                    matched = [t for t in tabs if any(d in t.get("url", "").lower() for d in ("meinungsplatz", "bilendi", "survey", "gfk", "maximiles", "cinode", "opinion", "mriweb"))]
                if not matched and tabs:
                    matched = [tabs[-1]]
                if matched:
                    t = matched[-1]
                    ws_url = t["webSocketDebuggerUrl"]
                    self.ws = create_connection(ws_url, timeout=30)
                    self._send("Page.enable")
                    self._send("Runtime.enable")
                    self._send("DOM.enable")
                    self._send("Page.bringToFront")
                    return True
        except Exception:
            pass
        self.open_tab(url)
        return False

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
        self.ws = create_connection(ws_url, timeout=30)
        self._send("Page.enable")
        self._send("Runtime.enable")
        self._send("DOM.enable")

    def get_current_url(self) -> str:
        try:
            res = self._send("Runtime.evaluate", {"expression": "location.href", "returnByValue": True})
            return str(res.get("result", {}).get("value") or "")
        except Exception:
            return ""
        self._send("Page.bringToFront")

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
        time.sleep(2.0)  # crude but adequate settle time for survey pages

    def screenshot(self, path: str) -> str:
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
    return (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-value') || '').trim();
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
        js = self._FIND_JS % json.dumps(text)
        result = self._send("Runtime.evaluate", {"expression": js, "returnByValue": True})
        value = result.get("result", {}).get("value")
        if not value or value == "null":
            return None
        return json.loads(value)

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
