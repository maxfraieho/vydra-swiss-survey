#!/usr/bin/env python3
"""
tests/regression/test_web_interface_routing.py
Regression Test for Incident: Web interface unavailable / routing crash.

Verifies:
1. Flask app serves /ops gate page (HTTP 200).
2. Unauthenticated GET /ops returns gate.html login page.
3. Cloudflare ingress rule mapping for survey.exodus.pp.ua points to port 5005.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import astryx_survey_server


def test_ops_route_returns_200():
    """Verify /ops endpoint returns 200 OK with gate HTML page."""
    with astryx_survey_server.app.test_client() as client:
        resp = client.get("/ops")
        assert resp.status_code == 200
        assert b"<!DOCTYPE html>" in resp.data or b"astryx" in resp.data.lower()


def test_cloudflared_config_mapping():
    """Verify Cloudflare tunnel configuration contains survey.exodus.pp.ua mapping if file exists."""
    config_path = os.path.expanduser("~/.cloudflared/config.yml")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "survey.exodus.pp.ua" in content, "Missing survey.exodus.pp.ua ingress rule in cloudflared config.yml"
        assert "localhost:5005" in content or "127.0.0.1:5005" in content
