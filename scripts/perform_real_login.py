#!/usr/bin/env python3
"""Perform real login into meinungsplatz.ch / espacedopinion.ch on laptop Comet."""
import os
import sys
import time
import json
import random
import base64
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
    print("=== CONNECTING TO COMET LAPTOP (192.168.3.30) ===")
    client = cdp_client.CDPClient(local_port=9226)
    client.attach_or_open_tab("https://meinungsplatz.ch/")
    ws = client.ws

    print("\n--- Step 1: Navigating to https://meinungsplatz.ch/ ---")
    send_cdp(ws, "Page.navigate", {"url": "https://meinungsplatz.ch/"})
    time.sleep(3.0)

    # 1. Clear and type email
    print("--- Step 2: Entering Email (tukroschu@gmail.com) with human jitter ---")
    send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var email = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            if (email) {
                email.focus();
                email.value = '';
                return true;
            }
            return false;
        })()
        """
    })
    time.sleep(0.4)
    
    email_str = "tukroschu@gmail.com"
    for char in email_str:
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "text": char})
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "text": char})
        time.sleep(random.uniform(0.06, 0.14))
    
    time.sleep(0.8)

    # 2. Clear and type password
    print("--- Step 3: Entering Password with human jitter ---")
    send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var pass = document.querySelector('input[type="password"]');
            if (pass) {
                pass.focus();
                pass.value = '';
                return true;
            }
            return false;
        })()
        """
    })
    time.sleep(0.4)
    
    pass_str = "Iris0523"
    for char in pass_str:
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "text": char})
        send_cdp(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "text": char})
        time.sleep(random.uniform(0.06, 0.12))

    time.sleep(1.2)

    # Screenshot before submit
    shot_pre = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/tmp/pre_submit.jpg", "wb") as f:
        f.write(base64.b64decode(shot_pre["data"]))

    # 3. Click Submit Button (S'identifier)
    print("--- Step 4: Clicking Submit Button (S'identifier) ---")
    click_res = send_cdp(ws, "Runtime.evaluate", {
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
    print("Submit action:", click_res.get("result", {}).get("value"))

    print("Waiting 5 seconds for page redirect / dashboard...")
    time.sleep(5.0)

    # 4. Check post-login status
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

    # 5. Capture screenshot
    shot_post = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    post_bytes = base64.b64decode(shot_post["data"])
    shot_file = "/tmp/real_login_dashboard.jpg"
    with open(shot_file, "wb") as f:
        f.write(post_bytes)
    print(f"\n📸 Post-login screenshot saved to {shot_file} ({len(post_bytes)} bytes)")

    # Save to evidence folders
    for p in [
        os.path.join(BASE_DIR, "specs", "020-ops-viewport-and-tabs", "evidence", "auth", "02-login.png"),
        os.path.join(BASE_DIR, "docs", "astryx-refactor", "evidence", "020", "auth", "02-login.png")
    ]:
        with open(p, "wb") as f:
            f.write(post_bytes)

if __name__ == "__main__":
    run()
