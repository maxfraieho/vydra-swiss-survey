#!/usr/bin/env python3
"""Autofill credentials via event dispatching + CDP keys and click S'identifier."""
import os
import sys
import time
import json
import base64
import random
import requests
from websocket import create_connection

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

import cdp_client

def send_cdp(ws, method, params=None, timeout=20.0):
    msg_id = random.randint(1000, 999999)
    payload = {"id": msg_id, "method": method, "params": params or {}}
    ws.send(json.dumps(payload))
    deadline = time.time() + timeout
    while time.time() < deadline:
        ws.settimeout(max(0.2, deadline - time.time()))
        try:
            raw = ws.recv()
            d = json.loads(raw)
            if d.get("id") == msg_id:
                if "error" in d:
                    raise RuntimeError(f"{method} error: {d['error']}")
                return d.get("result", {})
        except Exception as e:
            if time.time() >= deadline:
                raise TimeoutError(f"{method} timed out: {e}")

def run():
    print("=== CONNECTING TO COMET LAPTOP ===")
    client = cdp_client.CDPClient(local_port=9226)
    client.attach_or_open_tab("https://meinungsplatz.ch/")
    ws = client.ws

    print("--- Step 1: Navigating to https://meinungsplatz.ch/ ---")
    send_cdp(ws, "Page.navigate", {"url": "https://meinungsplatz.ch/"})
    time.sleep(2.5)

    # 1. Get bbox of email input
    bbox_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var el = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            if (!el) return null;
            var r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height };
        })()
        """,
        "returnByValue": True
    })
    bbox = bbox_res.get("result", {}).get("value")
    print(f"Email Input BBox: {bbox}")

    if bbox:
        # Click email field to trigger dropdown
        print("Clicking email input...")
        send_cdp(ws, "Input.dispatchMouseEvent", {"type": "mousePressed", "x": bbox["x"], "y": bbox["y"], "button": "left", "clickCount": 1})
        send_cdp(ws, "Input.dispatchMouseEvent", {"type": "mouseReleased", "x": bbox["x"], "y": bbox["y"], "button": "left", "clickCount": 1})
        time.sleep(0.5)

        # Arrow down and Enter
        print("Sending ArrowDown + Enter...")
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "rawKeyDown", "windowsVirtualKeyCode": 40, "code": "ArrowDown", "key": "ArrowDown"})
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "windowsVirtualKeyCode": 40, "code": "ArrowDown", "key": "ArrowDown"})
        time.sleep(0.3)
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "rawKeyDown", "windowsVirtualKeyCode": 13, "code": "Enter", "key": "Enter"})
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "windowsVirtualKeyCode": 13, "code": "Enter", "key": "Enter"})
        time.sleep(0.8)

    # 2. Set value with event dispatching to guarantee value binding
    print("Setting credentials directly with full React/DOM event dispatching...")
    fill_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var email = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            var pass = document.querySelector('input[type="password"]');
            if (email) {
                email.value = 'tukroschu@gmail.com';
                email.dispatchEvent(new Event('input', { bubbles: true }));
                email.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (pass) {
                pass.value = 'Iris0523';
                pass.dispatchEvent(new Event('input', { bubbles: true }));
                pass.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return {
                email: email ? email.value : null,
                hasPass: pass ? Boolean(pass.value) : false
            };
        })()
        """,
        "returnByValue": True
    })
    print("Form filled status:", fill_res.get("result", {}).get("value"))

    # Screenshot before clicking submit
    shot1 = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/tmp/before_submit_fill.jpg", "wb") as f:
        f.write(base64.b64decode(shot1["data"]))

    # 3. Click Submit button
    print("Clicking submit button (S'identifier)...")
    submit_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var btn = document.querySelector('input[value="S\\'identifier"], button[type="submit"], input[type="submit"], .btn-login');
            if (btn) {
                btn.click();
                return "button_clicked";
            }
            var form = document.querySelector('form');
            if (form) {
                form.submit();
                return "form_submitted";
            }
            return "not_found";
        })()
        """,
        "returnByValue": True
    })
    print("Submit action:", submit_res.get("result", {}).get("value"))

    print("Waiting 6 seconds for login redirect...")
    time.sleep(6.0)

    # 4. Check post-login state
    post_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var isUserLoggedIn = Boolean(document.querySelector('.logout, a[href*="logout"], a[href*="deconnexion"], .user-profile, .dashboard, #user-menu, .account, .profil'));
            var headings = Array.from(document.querySelectorAll('h1, h2, h3, .user-name, .points, .solde, .balance')).map(e => e.innerText.trim()).filter(Boolean);
            var errorEl = document.querySelector('.error, .alert-danger, .error-message, .form-error, .alert, .notification');
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                isUserLoggedIn: isUserLoggedIn,
                errorText: errorEl ? errorEl.innerText : null,
                headings: headings.slice(0, 10),
                bodySnippet: document.body.innerText.substring(0, 500)
            });
        })()
        """,
        "returnByValue": True
    })
    post_data = json.loads(post_res.get("result", {}).get("value", "{}"))
    print("\n=== POST-LOGIN RESULT ===")
    print(json.dumps(post_data, indent=2, ensure_ascii=False))

    # 5. Capture final screenshot
    shot2 = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    shot2_bytes = base64.b64decode(shot2["data"])
    with open("/tmp/after_login_attempt.jpg", "wb") as f:
        f.write(shot2_bytes)
    print(f"📸 Final screenshot saved to /tmp/after_login_attempt.jpg ({len(shot2_bytes)} bytes)")

if __name__ == "__main__":
    run()
