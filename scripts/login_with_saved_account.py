#!/usr/bin/env python3
"""Log in on meinungsplatz.ch using the saved browser credentials."""
import os
import sys
import time
import json
import base64
import requests
from websocket import create_connection

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

import cdp_client

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
    print("=== CONNECTING VIA CDP CLIENT TO LAPTOP ===")
    client = cdp_client.CDPClient(local_port=9226)
    client.attach_or_open_tab("https://meinungsplatz.ch/")
    ws = client.ws

    # Navigate fresh to meinungsplatz.ch
    print("Navigating to https://meinungsplatz.ch/ ...")
    send_cdp(ws, "Page.navigate", {"url": "https://meinungsplatz.ch/"})
    time.sleep(3.0)

    # Inspect fields to check if Chrome auto-filled them
    inspect_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var emailInput = document.querySelector('input[type="email"], input[name="email"], input[type="text"]');
            var passInput = document.querySelector('input[type="password"]');
            return JSON.stringify({
                emailValue: emailInput ? emailInput.value : '',
                hasPassword: passInput ? Boolean(passInput.value) : false
            });
        })()
        """,
        "returnByValue": True
    })
    form_state = json.loads(inspect_res.get("result", {}).get("value", "{}"))
    print("Pre-fill state from browser:", form_state)

    # Click Submit (S'identifier)
    print("Clicking submit button (S'identifier)...")
    send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var submitBtn = document.querySelector('input[value="S\\'identifier"], button[type="submit"], input[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
                return true;
            }
            return false;
        })()
        """
    })

    print("Waiting 5 seconds for page load / redirect...")
    time.sleep(5.0)

    # Check new page state
    post_res = send_cdp(ws, "Runtime.evaluate", {
        "expression": """
        (function() {
            var isUserLoggedIn = Boolean(document.querySelector('.logout, a[href*="logout"], a[href*="deconnexion"], .user-profile, .dashboard, #user-menu, .account'));
            var headings = Array.from(document.querySelectorAll('h1, h2, h3, .user-name, .points')).map(e => e.innerText.trim()).filter(Boolean);
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                isUserLoggedIn: isUserLoggedIn,
                headings: headings.slice(0, 10),
                bodyText: document.body.innerText.substring(0, 400)
            });
        })()
        """,
        "returnByValue": True
    })
    post_state = json.loads(post_res.get("result", {}).get("value", "{}"))
    print("Post-Login State:", json.dumps(post_state, indent=2, ensure_ascii=False))

    # Take screenshot of logged in state
    shot = send_cdp(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    shot_bytes = base64.b64decode(shot["data"])
    shot_path = "/tmp/logged_in_dashboard.jpg"
    with open(shot_path, "wb") as f:
        f.write(shot_bytes)
    print(f"📸 Screenshot saved to {shot_path} ({len(shot_bytes)} bytes)")

    # Save to evidence
    with open(os.path.join(BASE_DIR, "specs", "020-ops-viewport-and-tabs", "evidence", "auth", "02-login.png"), "wb") as f:
        f.write(shot_bytes)
    with open(os.path.join(BASE_DIR, "docs", "astryx-refactor", "evidence", "020", "auth", "02-login.png"), "wb") as f:
        f.write(shot_bytes)

if __name__ == "__main__":
    run()
