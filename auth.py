import hmac
import os
import time
from flask import Blueprint, jsonify, redirect, render_template, request

auth_bp = Blueprint("auth", __name__)

_RATE_LIMIT_STORE = {}
_WINDOW_SECONDS = 600
_MAX_FAILURES = 10
_LOCKOUT_SECONDS = 60


def _site_secret() -> str | None:
    sec = os.environ.get("ASTRYX_API_TOKEN")
    return sec if sec else None


def is_authed(req) -> bool:
    secret = _site_secret()
    if not secret:
        return False
    hdr = req.headers.get("X-Astryx-Token")
    cookie = req.cookies.get("astryx_k")

    hdr_valid = hmac.compare_digest(hdr, secret) if hdr else False
    cookie_valid = hmac.compare_digest(cookie, secret) if cookie else False

    return hdr_valid or cookie_valid


def issue_cookie(resp, secret: str):
    is_secure = True if (request.headers.get("X-Forwarded-Proto") == "https" or request.is_secure) else False
    resp.set_cookie(
        "astryx_k",
        secret,
        httponly=True,
        samesite="Lax",
        secure=is_secure,
        path="/",
        max_age=15552000,
    )
    return resp


def clear_cookie(resp):
    resp.delete_cookie("astryx_k", path="/", samesite="Lax")
    return resp


def _wants_html(req) -> bool:
    accept_hdr = req.headers.get("Accept", "")
    return bool(req.accept_mimetypes.accept_html or ("application/json" not in accept_hdr))


def _check_rate_limit(ip: str) -> bool:
    now = time.time()
    data = _RATE_LIMIT_STORE.get(ip)
    if data and now < data.get("lockout_until", 0):
        return True
    return False


def _record_failure(ip: str):
    now = time.time()
    if ip not in _RATE_LIMIT_STORE:
        _RATE_LIMIT_STORE[ip] = {"failures": [], "lockout_until": 0}

    data = _RATE_LIMIT_STORE[ip]
    failures = [t for t in data.get("failures", []) if now - t < _WINDOW_SECONDS]
    failures.append(now)
    data["failures"] = failures

    if len(failures) >= _MAX_FAILURES:
        data["lockout_until"] = now + _LOCKOUT_SECONDS


def _clear_failures(ip: str):
    if ip in _RATE_LIMIT_STORE:
        _RATE_LIMIT_STORE.pop(ip, None)


@auth_bp.route("/api/auth", methods=["POST"])
def login():
    ip = request.remote_addr or "127.0.0.1"

    if _check_rate_limit(ip):
        if _wants_html(request):
            return render_template("gate.html", error="Занадто багато спроб. Зачекайте 1 хвилину."), 429
        return jsonify({"ok": False, "error": "rate limit exceeded"}), 429

    secret = _site_secret()
    if not secret:
        if _wants_html(request):
            return render_template("gate.html", error="server not configured"), 503
        return jsonify({"error": "ASTRYX_API_TOKEN not set"}), 503

    key = request.form.get("key")
    if key is None:
        json_data = request.get_json(silent=True)
        if isinstance(json_data, dict):
            key = json_data.get("key")

    if not isinstance(key, str):
        key = ""

    if hmac.compare_digest(key, secret):
        _clear_failures(ip)
        if _wants_html(request):
            resp = redirect("/", code=303)
            issue_cookie(resp, secret)
            return resp
        else:
            resp = jsonify({"ok": True})
            issue_cookie(resp, secret)
            return resp, 200
    else:
        time.sleep(1)
        _record_failure(ip)
        if _wants_html(request):
            return render_template("gate.html", error="Невірний пароль"), 401
        else:
            return jsonify({"ok": False, "error": "невірний пароль"}), 401


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    if _wants_html(request):
        resp = redirect("/", code=303)
        clear_cookie(resp)
        return resp
    else:
        resp = jsonify({"ok": True})
        clear_cookie(resp)
        return resp, 200
