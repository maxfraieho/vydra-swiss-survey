#!/usr/bin/env python3
"""Submit login on meinungsplatz.ch / espacedopinion.ch and inspect state."""
import os
import sys
import time
import json
import base64
import requests
from websocket import create_connection

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

def send_cdp(ws, method, params=None, timeout=20.0):
    import random
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
    print("=== CONNECTING TO COMET TAB ON LAPTOP ===")
    r = requests.get("http://127.0.0.1:9226/json/list", timeout=5)
    tabs = [t for t in r.json() if t.get("type") == "page"]
    survey_tab = next((t for t in tabs if "meinung" in t.get("url", "").lower() or "opinion" in t.get("url", "").lower()), None)
    if not survey_tab:
        survey_tab = tabs[0]
    
    print(f"Target tab: {survey_tab['id'][:8]} ({survey_tab.get('title')}) -> {survey_tab.get('url')}")
    ws = create_connection(survey_tab["webSocketDebuggerUrl"], timeout=20)
    send_cdp(ws, "Page.enable")
    send_cdp(ws, "Runtime.enable")
    send_cdp(ws, "DOM.enable")
    send_cdp(ws, "Page.bringToFront")

    # Inspect current form state
    inspect_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var emailInput = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            var passInput = document.querySelector('input[type="password"]');
            var submitBtn = document.querySelector('input[value="S\\'identifier"], button[type="submit"], input[type="submit"], .btn-login, #login-submit');
            var errorMsg = document.querySelector('.error, .alert-danger, .error-message, .form-error, .alert')?.innerText || '';
            var bodyText = document.body.innerText.substring(0, 500);
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                emailValue: emailInput ? emailInput.value : null,
                hasPassword: passInput ? Boolean(passInput.value) : false,
                submitBtnFound: Boolean(submitBtn),
                submitBtnText: submitBtn ? (submitBtn.value || submitBtn.innerText) : null,
                errorMsg: errorMsg,
                bodySnippet: bodyText
            });
        })()
        """,
        "returnByValue": True
    })
    info = json.loads(inspect_res.get("result", {}).get("value", "{}"))
    print("Initial Form State:", json.dumps(info, indent=2, ensure_ascii=False))

    # Click Submit Button
    print("\n--- Clicking Submit Button (S'identifier) ---")
    click_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var submitBtn = document.querySelector('input[value="S\\'identifier"], button[type="submit"], input[type="submit"], .btn-login, #login-submit');
            if (submitBtn) {
                submitBtn.click();
                return "clicked";
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
    print(f"Click Result: {click_res.get('result', {}).get('value')}")

    # Wait for page response / navigation
    print("Waiting 4 seconds for server response...")
    time.sleep(4.0)

    # Inspect post-submit state
    post_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var emailInput = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            var errorMsg = document.querySelector('.error, .alert-danger, .error-message, .form-error, .alert, .notification')?.innerText || '';
            var isUserLoggedIn = Boolean(document.querySelector('.logout, a[href*="logout"], a[href*="deconnexion"], .user-profile, .dashboard'));
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                isUserLoggedIn: isUserLoggedIn,
                errorMsg: errorMsg,
                bodySnippet: document.body.innerText.substring(0, 400)
            });
        })()
        """,
        "returnByValue": True
    })
    post_info = json.loads(post_res.get("result", {}).get("value", "{}"))
    print("\nPost-Submit State:", json.dumps(post_info, indent=2, ensure_ascii=False))

    # Take screenshot of post-submit state
    shot = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    shot_data = base64.b64decode(shot["data"])
    shot_path = "/tmp/post_login_attempt.jpg"
    with open(shot_path, "wb") as f:
        f.write(shot_data)
    print(f"📸 Saved post-login screenshot to {shot_path} ({len(shot_data)} bytes)")

if __name__ == "__main__":
    run()
