import os
import sys
import json
import time
import re
import urllib.request
import urllib.parse
import threading
import subprocess
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, render_template_string, send_file, render_template, make_response
from rules_api import rules_bp
from settings_api import settings_bp
from auth import auth_bp, is_authed, _site_secret
import persona_graph_memory

app = Flask(__name__)
app.secret_key = "astryx_swiss_survey_secret_key_5005"
app.register_blueprint(auth_bp)
app.register_blueprint(rules_bp)
app.register_blueprint(settings_bp)


@app.before_request
def global_auth_gate():
    # Allow authentication endpoints, Telegram webhooks, and static frontend assets
    if request.path.startswith(("/api/auth", "/api/survey/telegram_push", "/api/survey/fetch_telegram", "/assets/")):
        return None

    if request.path.endswith((".js", ".css", ".map", ".svg", ".png", ".woff", ".woff2", ".ico")):
        return None

    if is_authed(request):
        return None

    if not _site_secret():
        if request.path.startswith("/api/"):
            return jsonify({"error": "server not configured"}), 503
        resp = make_response(render_template("gate.html", error="server not configured"), 503)
        resp.headers["Cache-Control"] = "no-store, must-revalidate"
        resp.headers["Vary"] = "Cookie"
        return resp

    if request.path.startswith("/api/"):
        return jsonify({"error": "unauthorized"}), 401

    resp = make_response(render_template("gate.html"), 200)
    resp.headers["Cache-Control"] = "no-store, must-revalidate"
    resp.headers["Vary"] = "Cookie"
    return resp

def get_telegram_bot_token() -> str:
    default_token = "8861125591:AAFUAdGZr_r3yq39msEBKaHorSmbJK4zT-s"
    env_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if env_token and ":" in env_token and len(env_token) > 20:
        return env_token
    db_token = persona_graph_memory.get_setting("telegram_bot_token")
    if db_token and ":" in db_token and len(db_token) > 20:
        return db_token
    return default_token

TELEGRAM_BOT_TOKEN = get_telegram_bot_token()

PROFILES = {
    "arno": {"name": "Арсен", "label": "Arno (Арсен)"},
    "annet": {"name": "Олена", "label": "Annette (Олена)"}
}

PENDING_TASKS = []
CURRENT_PROC = None
CURRENT_PROC_LOCK = threading.Lock()

ACTIVE_SURVEY_STATE = {
    "status": "idle", # idle, waiting_auth, running, waiting_verification, finished, error
    "reason_code": None, # captcha_detected, wrong_element, etc.
    "active_task_id": None,
    "profile": None,
    "url": None,
    "reward": None,
    "duration": None,
    "trigger_time": None,
    "wait_expires_at": None,
    "training_mode": True,
    "pending_step": None,
    "pending_decision": None,
    "bounding_boxes": [],
    "verification_event": threading.Event(),
    "verification_result": None,
    "log_history": [],
    "last_error": None,
    "tutor_activity": {
        "last_action_source": "idle",
        "tutor_explanation": "Тутор активний. Очікування вибору опитування або ручної корекції.",
        "matched_rule": None,
        "promotion_info": None,
        "updated_at": None
    }
}

STATE_LOCK = threading.Lock()

def update_tutor_activity(source: str, explanation: str, rule: dict | None = None, promo: dict | None = None):
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["tutor_activity"] = {
            "last_action_source": source,
            "tutor_explanation": explanation,
            "matched_rule": rule,
            "promotion_info": promo,
            "updated_at": datetime.now().strftime("%H:%M:%S")
        }

def add_log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry, flush=True)
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["log_history"].append(entry)
        if len(ACTIVE_SURVEY_STATE["log_history"]) > 200:
            ACTIVE_SURVEY_STATE["log_history"].pop(0)

TELEGRAM_LISTENER_STATE = {
    "status": "active",
    "last_update_at": None,
    "last_error": None
}

RECENT_TELEGRAM_PUSHES = []

def record_telegram_push(payload, text: str, url: str | None = None) -> dict:
    update_id = None
    if isinstance(payload, dict):
        update_id = payload.get("update_id")
    if not update_id:
        update_id = int(time.time() * 1000)

    now_iso = datetime.now().isoformat()
    item = {
        "update_id": update_id,
        "url": url or "",
        "text": text or "",
        "received_at": now_iso,
        "state": "pending"
    }

    with STATE_LOCK:
        TELEGRAM_LISTENER_STATE["last_update_at"] = now_iso
        TELEGRAM_LISTENER_STATE["status"] = "active"
        TELEGRAM_LISTENER_STATE["last_error"] = None

        # 1. Deduplicate by update_id: update existing item if present
        for ex in RECENT_TELEGRAM_PUSHES:
            if str(ex.get("update_id")) == str(update_id):
                if url:
                    ex["url"] = url
                if text:
                    ex["text"] = text
                return ex

        # 2. Deduplicate by URL among pending items: remove older pending item with the same URL
        if url:
            RECENT_TELEGRAM_PUSHES[:] = [
                ex for ex in RECENT_TELEGRAM_PUSHES
                if not (ex.get("state") == "pending" and ex.get("url") == url)
            ]

        RECENT_TELEGRAM_PUSHES.append(item)
        if len(RECENT_TELEGRAM_PUSHES) > 50:
            RECENT_TELEGRAM_PUSHES.pop(0)

    return item

def extract_text_and_url_from_payload(payload):
    text = ""
    extracted_url = None

    if isinstance(payload, str):
        text = payload
    elif isinstance(payload, dict):
        msg = payload.get("message") or payload.get("channel_post") or payload.get("edited_message") or payload.get("edited_channel_post") or payload
        text = msg.get("text") or msg.get("caption") or payload.get("text") or payload.get("caption") or ""
        
        entities = msg.get("entities") or msg.get("caption_entities") or payload.get("entities") or payload.get("caption_entities") or []
        for ent in entities:
            if isinstance(ent, dict) and ent.get("type") == "text_link" and ent.get("url"):
                extracted_url = ent["url"]
                break

    if not extracted_url and text:
        md_match = re.search(r'\[.*?\]\((https?://[^\s\)]+)\)', text)
        if md_match:
            extracted_url = md_match.group(1)
        else:
            url_match = re.search(r'(https?://[^\s>"\']+)', text)
            if url_match:
                extracted_url = url_match.group(1)

    if extracted_url:
        extracted_url = extracted_url.rstrip(").,]\"';!?:")

    return text, extracted_url

def fetch_telegram_api(optional_payload=None):
    count = 0
    
    # 1. Process optional_payload if provided
    if optional_payload:
        text, url = extract_text_and_url_from_payload(optional_payload)
        if text or url:
            record_telegram_push(optional_payload, text, url)
            task = push_task_from_text(text or url or "", force=True, override_url=url)
            if task:
                count += 1

    # 2. Query Telegram getUpdates API
    token = get_telegram_bot_token()
    if token:
        try:
            req_url = f"https://api.telegram.org/bot{token}/getUpdates?limit=20"
            req = urllib.request.Request(req_url, headers={"User-Agent": "AstryxSurveyServer/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("ok"):
                    with STATE_LOCK:
                        TELEGRAM_LISTENER_STATE["status"] = "active"
                        TELEGRAM_LISTENER_STATE["last_error"] = None
                        TELEGRAM_LISTENER_STATE["last_update_at"] = datetime.now().isoformat()
                    for update in data.get("result", []):
                        text, url = extract_text_and_url_from_payload(update)
                        if text or url:
                            record_telegram_push(update, text, url)
                            task = push_task_from_text(text or url or "", force=True, override_url=url)
                            if task:
                                count += 1
                else:
                    with STATE_LOCK:
                        TELEGRAM_LISTENER_STATE["status"] = "error"
                        TELEGRAM_LISTENER_STATE["last_error"] = data.get("description", "Telegram getUpdates returned not ok")
        except Exception as e:
            with STATE_LOCK:
                TELEGRAM_LISTENER_STATE["status"] = "error"
                TELEGRAM_LISTENER_STATE["last_error"] = str(e)
            add_log(f"⚠️ getUpdates warning: {e}")

    return {"status": "success", "processed": count}

def notify_tutor_captcha_blocking(persona: str, url: str, captchas: list[str]) -> bool:
    token = get_telegram_bot_token()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID") or persona_graph_memory.get_setting("telegram_chat_id")
    if not token or not chat_id:
        add_log("⚠️ notify_tutor_captcha_blocking: Telegram token or chat_id missing")
        return False
    captcha_str = ", ".join(captchas) if captchas else "unknown"
    msg_text = f"⚠️ CAPTCHA Blocking detected!\nPersona: {persona}\nURL: {url}\nCAPTCHAs: {captcha_str}"
    try:
        req_url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = json.dumps({"chat_id": chat_id, "text": msg_text}).encode("utf-8")
        req = urllib.request.Request(
            req_url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "AstryxSurveyServer/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("ok"):
                add_log(f"📲 Telegram captcha alert sent to {chat_id}")
                return True
    except Exception as e:
        add_log(f"⚠️ Failed to send Telegram captcha alert: {e}")
    return False

def push_task_from_text(text: str, force: bool = False, override_url: str | None = None):
    profile = None
    if "Арсена" in text or "Arno" in text or "Арсен" in text:
        profile = "arno"
    elif "Олени" in text or "Annette" in text or "Олена" in text:
        profile = "annet"
    else:
        profile = "arno"  # Default fallback profile
        
    reward_match = re.search(r'([\d\.]+\s*CHF)', text)
    reward = reward_match.group(1) if reward_match else "1.0 CHF"
    
    duration_match = re.search(r'([\d\.]+\s*min)', text)
    duration = duration_match.group(1) if duration_match else "10 min"
    
    if override_url:
        survey_url = override_url
    else:
        url_match = re.search(r'(https?://[^\s>"\']+)', text)
        survey_url = url_match.group(1) if url_match else "https://meinungsplatz.ch/"
    
    import uuid
    now_dt = datetime.now()
    task_id = f"task_{profile}_{int(now_dt.timestamp()*1000)}_{uuid.uuid4().hex[:4]}"
    task_item = {
        "id": task_id,
        "profile": profile,
        "profile_name": PROFILES[profile]["name"],
        "url": survey_url,
        "reward": reward,
        "duration": duration,
        "created_at": now_dt.strftime("%H:%M:%S"),
        "created_timestamp": now_dt.timestamp(),
        "wait_expires_at": (now_dt + timedelta(minutes=10)).isoformat(),
        "status": "waiting_auth"
    }
    
    with STATE_LOCK:
        # Check for duplicate submissions (only if previous task is still actively waiting_auth)
        is_recent_duplicate = False
        if not force:
            for t in PENDING_TASKS:
                if t["profile"] == profile and t["reward"] == reward and t["status"] == "waiting_auth":
                    created_ts = t.get("created_timestamp", 0)
                    if now_dt.timestamp() - created_ts < 30 and ACTIVE_SURVEY_STATE.get("active_task_id") == t["id"] and ACTIVE_SURVEY_STATE.get("status") == "waiting_auth":
                        is_recent_duplicate = True
                        task_item = t
                        break

        if not is_recent_duplicate or force:
            # If force or not recent duplicate, ensure task is in queue
            if not any(t["id"] == task_item["id"] for t in PENDING_TASKS):
                PENDING_TASKS.append(task_item)
            
            # If system is idle or missing active task, set as active automatically
            if ACTIVE_SURVEY_STATE["status"] in ("idle", "finished", "error") or not ACTIVE_SURVEY_STATE.get("active_task_id"):
                set_active_task_locked(task_item)
                
    add_log(f"🔔 Нове опитування додано в чергу: {PROFILES[profile]['name']} ({reward}, {duration})")
    return task_item

def set_active_task_locked(task_item):
    ACTIVE_SURVEY_STATE["status"] = "waiting_auth"
    ACTIVE_SURVEY_STATE["active_task_id"] = task_item["id"]
    ACTIVE_SURVEY_STATE["profile"] = task_item["profile"]
    ACTIVE_SURVEY_STATE["url"] = task_item["url"]
    ACTIVE_SURVEY_STATE["reward"] = task_item["reward"]
    ACTIVE_SURVEY_STATE["duration"] = task_item["duration"]
    ACTIVE_SURVEY_STATE["trigger_time"] = datetime.now()
    ACTIVE_SURVEY_STATE["wait_expires_at"] = datetime.fromisoformat(task_item["wait_expires_at"])

def telegram_listener_thread():
    add_log("🤖 Telegram-бот слухач активний.")
    last_update_id = 0
    with STATE_LOCK:
        TELEGRAM_LISTENER_STATE["status"] = "active"
        TELEGRAM_LISTENER_STATE["last_error"] = None
    
    while True:
        try:
            token = get_telegram_bot_token()
            if not token:
                with STATE_LOCK:
                    TELEGRAM_LISTENER_STATE["status"] = "error"
                    TELEGRAM_LISTENER_STATE["last_error"] = "Telegram bot token is not configured"
                time.sleep(5)
                continue

            url = f"https://api.telegram.org/bot{token}/getUpdates"
            params = urllib.parse.urlencode({"offset": last_update_id + 1, "timeout": 20})
            req = urllib.request.Request(f"{url}?{params}")
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("ok"):
                    with STATE_LOCK:
                        TELEGRAM_LISTENER_STATE["status"] = "active"
                        TELEGRAM_LISTENER_STATE["last_error"] = None
                    for update in data.get("result", []):
                        last_update_id = max(last_update_id, update.get("update_id", 0))
                        msg = update.get("message") or update.get("channel_post") or update.get("edited_message") or update.get("edited_channel_post") or {}
                        chat = msg.get("chat", {})
                        if chat.get("id"):
                            persona_graph_memory.save_setting("telegram_chat_id", str(chat.get("id")))
                        text, extracted_url = extract_text_and_url_from_payload(update)
                        if text or extracted_url:
                            record_telegram_push(update, text, extracted_url)
                            push_task_from_text(text, force=True, override_url=extracted_url)
                else:
                    err_msg = data.get("description", "getUpdates returned not ok")
                    with STATE_LOCK:
                        TELEGRAM_LISTENER_STATE["status"] = "error"
                        TELEGRAM_LISTENER_STATE["last_error"] = err_msg
                    time.sleep(5)
        except Exception as e:
            with STATE_LOCK:
                TELEGRAM_LISTENER_STATE["status"] = "error"
                TELEGRAM_LISTENER_STATE["last_error"] = str(e)
            add_log(f"⚠️ Telegram listener warning: {e}")
            time.sleep(5)

def auto_start_timer_thread():
    while True:
        time.sleep(3)
        should_start = False
        profile = None
        url = None
        with STATE_LOCK:
            if ACTIVE_SURVEY_STATE["status"] == "waiting_auth":
                now = datetime.now()
                expires = ACTIVE_SURVEY_STATE["wait_expires_at"]
                if expires and now >= expires:
                    ACTIVE_SURVEY_STATE["status"] = "starting"
                    profile = ACTIVE_SURVEY_STATE["profile"]
                    url = ACTIVE_SURVEY_STATE["url"]
                    should_start = True
        if should_start:
            add_log("⏳ 10 хвилин очікування вичерпано. Автоматичний запуск опитування в автономному режимі!")
            threading.Thread(target=run_survey_execution, args=(profile, url), daemon=True).start()

def run_survey_execution(profile: str, url: str, resume_tab_url: str | None = None):
    global CURRENT_PROC
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "running"

    add_log(f"🚀 Ексклюзивний запуск Gemma 3 4B Survey Agent for {profile}...")
    try:
        cmd = ["bash", os.path.expanduser("~/llm-switch.sh"), "survey", profile, url, "-f"]
        if resume_tab_url:
            cmd += ["--resume-tab", resume_tab_url]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        with CURRENT_PROC_LOCK:
            CURRENT_PROC = proc
        for line in iter(proc.stdout.readline, ''):
            if line:
                add_log(line.strip())
        proc.wait()
        with CURRENT_PROC_LOCK:
            if CURRENT_PROC is proc:
                CURRENT_PROC = None
        with STATE_LOCK:
            if proc.returncode == 0:
                ACTIVE_SURVEY_STATE["status"] = "finished"
            else:
                ACTIVE_SURVEY_STATE["status"] = "error"
                ACTIVE_SURVEY_STATE["last_error"] = f"Exit code {proc.returncode}"
        if proc.returncode == 0:
            add_log("✅ Опитування успішно завершено.")
        else:
            add_log(f"❌ Завершено з помилкою (код {proc.returncode}).")
    except Exception as e:
        with CURRENT_PROC_LOCK:
            CURRENT_PROC = None
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "error"
            ACTIVE_SURVEY_STATE["last_error"] = str(e)
        add_log(f"❌ Помилка виконання: {e}")


ASTRYX_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Astryx Swiss Survey Console</title>
  <script src="https://cdn.tailwindcss.com" onerror="document.documentElement.classList.add('no-tailwind')"></script>
  <style>
    /* Fallback baseline (offline / CDN blocked): keeps UI usable without Tailwind */
    html.no-tailwind body { background:#020617; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0; }
    html.no-tailwind header, html.no-tailwind main > div { border:1px solid #1e293b; border-radius:12px; padding:16px; margin-bottom:16px; background:#0f172a; box-sizing:border-box; }
    html.no-tailwind button { background:#4f46e5; color:#fff; border:none; padding:10px 14px; border-radius:10px; cursor:pointer; margin:4px 4px 4px 0; font:inherit; }
    html.no-tailwind input, html.no-tailwind textarea { width:100%; box-sizing:border-box; padding:8px; margin:6px 0; background:#020617; color:#fff; border:1px solid #1e293b; border-radius:8px; }
    html.no-tailwind img#live-shot { max-width:100%; height:auto; }
    html.no-tailwind .grid { display:block; }
    html.no-tailwind #log-box { max-height:260px; overflow-y:auto; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
  <header class="bg-slate-900 border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-xl">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-emerald-500 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-950/50">
        A
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
          Astryx Survey & Training Hub <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono border border-indigo-500/40">Port 5005</span>
        </h1>
        <p class="text-xs text-slate-400">meinungsplatz.ch • SOCKS5 Proxy CH (100.66.97.93:1080) • Teacher-Student Trajectory Learning</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label class="flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold">
        <input id="toggle-training" type="checkbox" onchange="toggleTrainingMode(this.checked)" class="rounded text-indigo-500 focus:ring-0 w-4 h-4 bg-slate-950 border-slate-700">
        <span>🎓 Режим Навчання (Пауза & Коригування)</span>
      </label>
      <div id="status-badge" class="px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-slate-800 text-slate-300 border-slate-700">
        Оновлення...
      </div>
    </div>
  </header>

  <main class="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">

    <!-- Active Tasks Queue Grid -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          📋 Черга отриманих опитувань Telegram (Арсен & Олена)
        </h2>
        <div class="flex items-center gap-3">
          <button onclick="fetchTelegramTasks()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition-all">
            📥 Підтягнути опитування з Telegram
          </button>
          <button onclick="fetchStatus()" class="text-xs text-indigo-400 hover:text-indigo-300 font-mono px-2 py-2 -mx-2 -my-1">Оновити чергу</button>
        </div>
      </div>
      <div id="pending-tasks-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Dynamic task cards -->
      </div>
    </div>

    <!-- Active Trigger & Countdown Card -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <span class="text-xs uppercase font-mono text-indigo-400 tracking-wider font-bold">Активне Завдання у Виконанні</span>
          <h2 id="task-title" class="text-2xl font-black text-white mt-0.5">Немає активних опитувань</h2>
        </div>
        <div id="timer-box" class="hidden flex items-center gap-3 bg-indigo-950/60 border border-indigo-500/40 px-4 py-2 rounded-xl">
          <span class="text-xs text-indigo-300 font-semibold">Очікування авторизації (10 хв):</span>
          <span id="countdown" class="text-xl font-mono font-black text-indigo-400">10:00</span>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block">Профіль</span>
          <span id="detail-profile" class="font-bold text-slate-200 text-sm">-</span>
        </div>
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block">Винагорода</span>
          <span id="detail-reward" class="font-bold text-emerald-400 text-sm">-</span>
        </div>
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block">Тривалість</span>
          <span id="detail-duration" class="font-bold text-amber-400 text-sm">-</span>
        </div>
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block">Швейцарський Проксі</span>
          <span class="font-mono text-emerald-400 text-sm flex items-center gap-1">🟢 CH 100.66.97.93:1080</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-3 pt-2">
        <button onclick="authorizeNow()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2">
          ⚡ Авторизувати та Запустити негайно
        </button>
        <button onclick="openLiveBrowser()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all">
          🌐 Live CDP Браузер{% if active_browser_source %} ({{ active_browser_source.host }}:{{ active_browser_source.port }}){% endif %}
        </button>
        <button onclick="stopCurrent()" class="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs px-4 py-2.5 rounded-xl transition-all ml-auto">
          🛑 Зупинити
        </button>
      </div>
    </div>

    <!-- Live Screenshot & Human Verification / Teaching Panel -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            📸 Живий скріншот сторінки опитування
          </h3>
          <button onclick="refreshScreenshot()" class="text-xs text-indigo-400 hover:text-indigo-300 font-mono px-2 py-2 -mx-2 -my-1">Оновити</button>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-h-[350px] flex items-center justify-center relative">
          <img id="live-shot" src="/api/survey/screenshot/latest" alt="Live Screenshot" class="w-full object-contain max-h-[500px]" onerror="this.style.display='none'; document.getElementById('shot-placeholder').style.display='flex';" onload="this.style.display='block'; document.getElementById('shot-placeholder').style.display='none';" />
          <div id="shot-placeholder" class="hidden flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
            <span class="text-3xl">🖼️</span>
            <span class="text-xs font-mono">Скріншот очікує першого кроку виконання...</span>
          </div>
        </div>
      </div>

      <div class="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
        <div>
          <div class="border-b border-slate-800 pb-3">
            <h3 class="font-bold text-white text-base flex items-center gap-2">
              🎓 Навчання Агента (Human Feedback)
            </h3>
            <p class="text-xs text-slate-400">Перевірка рішення Gemma 3 4B та навчання новим правилам</p>
          </div>

          <div id="verif-box" class="pt-4 space-y-4">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span class="text-xs text-slate-500 font-mono uppercase block">Запропонована дія Gemma:</span>
              <div class="text-sm font-extrabold text-indigo-300" id="verif-action-text">Очікування кроку...</div>
              <div class="text-xs text-slate-300 font-mono bg-slate-900 p-2 rounded-lg" id="verif-target-text">-</div>
            </div>

            <div class="space-y-3 pt-2">
              <button onclick="approveDecision()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                ✅ Затвердити рішення Gemma та Записати в Траєкторію
              </button>
              
              <div class="border-t border-slate-800 pt-3 space-y-3">
                <span class="text-xs text-slate-300 font-semibold block">Коригування відповіді людини & Пояснення правила:</span>
                <input id="override-target-input" type="text" placeholder="Точна назва кнопки/пункту для вибору..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
                <textarea id="rule-explanation-input" rows="2" placeholder="Пояснення правила профайлу (напр. Для теми доходу вибирати вилку 60k-80k)..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"></textarea>
                
                <button onclick="overrideDecision()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all">
                  🎓 Навчити Агента та Записати у Graph Memory
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Execution Logs -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          📋 Системний лог та хронологія кроків
        </h3>
        <button onclick="fetchStatus()" class="text-xs text-indigo-400 hover:text-indigo-300 font-mono px-2 py-2 -mx-2 -my-1">Оновити</button>
      </div>
      <div id="log-box" class="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-1">
        <div class="text-slate-600">[Система очікує нових подій...]</div>
      </div>
    </div>
  </main>

  <script>
    let timerInterval = null;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/survey/status');
        const data = await res.json();
        updateUI(data);
      } catch (err) {
        console.error("Fetch status error:", err);
      }
    }

    function updateUI(data) {
      const badge = document.getElementById('status-badge');
      badge.innerText = data.status.toUpperCase();
      
      document.getElementById('toggle-training').checked = !!data.training_mode;

      if (data.status === 'waiting_auth') {
        badge.className = 'px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      } else if (data.status === 'waiting_verification') {
        badge.className = 'px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      } else if (data.status === 'running') {
        badge.className = 'px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse';
      } else if (data.status === 'finished') {
        badge.className = 'px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        badge.className = 'px-3 py-1.5 rounded-xl text-xs font-mono font-bold border bg-slate-800 text-slate-300 border-slate-700';
      }

      // Render Pending Tasks Queue Cards
      const queueDiv = document.getElementById('pending-tasks-list');
      if (data.pending_tasks && data.pending_tasks.length > 0) {
        queueDiv.innerHTML = data.pending_tasks.map(t => {
          const isArno = t.profile === 'arno';
          return `
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div class="min-w-0 flex-1">
                <span class="text-xs px-2 py-0.5 rounded font-mono font-bold ${isArno ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'}">
                  ${t.profile_name}
                </span>
                <div class="font-extrabold text-sm text-white mt-1">Опитування: ${t.reward} • ${t.duration}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-0.5 truncate">${t.url}</div>
              </div>
              <button onclick="selectAndAuthorizeTask('${t.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex-shrink-0">
                ⚡ Запустити
              </button>
            </div>
          `;
        }).join('');
      } else {
        queueDiv.innerHTML = `<div class="text-xs text-slate-500 font-mono">Немає очікуючих опитувань у черзі.</div>`;
      }

      if (data.profile) {
        document.getElementById('task-title').innerText = `Опитування для: ${data.profile === 'arno' ? 'Арсена' : 'Олени'}`;
        document.getElementById('detail-profile').innerText = data.profile === 'arno' ? 'Арсен' : 'Олена';
        document.getElementById('detail-reward').innerText = data.reward || 'Не вказано';
        document.getElementById('detail-duration').innerText = data.duration || 'Не вказано';
      } else {
        document.getElementById('task-title').innerText = 'Немає активних опитувань';
        document.getElementById('detail-profile').innerText = '-';
        document.getElementById('detail-reward').innerText = '-';
        document.getElementById('detail-duration').innerText = '-';
      }

      if (data.pending_decision) {
        document.getElementById('verif-action-text').innerText = `Крок ${data.pending_step}: ${data.pending_decision.action.toUpperCase()}`;
        document.getElementById('verif-target-text').innerText = `Ціль: "${data.pending_decision.target_text || data.pending_decision.value || ''}"`;
      }

      const timerBox = document.getElementById('timer-box');
      if (data.status === 'waiting_auth' && data.wait_seconds_remaining > 0) {
        timerBox.classList.remove('hidden');
        startCountdown(data.wait_seconds_remaining);
      } else {
        timerBox.classList.add('hidden');
        if (timerInterval) clearInterval(timerInterval);
      }

      const logBox = document.getElementById('log-box');
      if (data.log_history && data.log_history.length > 0) {
        logBox.innerHTML = data.log_history.map(line => `<div>${line}</div>`).join('');
        logBox.scrollTop = logBox.scrollHeight;
      }

      refreshScreenshot();
    }

    function refreshScreenshot() {
      const img = document.getElementById('live-shot');
      img.src = '/api/survey/screenshot/latest?t=' + new Date().getTime();
    }

    function startCountdown(seconds) {
      if (timerInterval) clearInterval(timerInterval);
      let rem = seconds;
      const el = document.getElementById('countdown');
      
      function render() {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        el.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (rem <= 0) {
          clearInterval(timerInterval);
          fetchStatus();
        }
        rem--;
      }
      render();
      timerInterval = setInterval(render, 1000);
    }

    async function fetchTelegramTasks() {
      try {
        const res = await fetch('/api/survey/fetch_telegram', { method: 'POST' });
        const data = await res.json();
        alert(`Підтягнуто завдання з Telegram: ${data.processed || 0}`);
        fetchStatus();
      } catch (err) {
        alert('Помилка підтягування з Telegram: ' + err);
      }
    }

    async function selectAndAuthorizeTask(taskId) {
      await fetch('/api/survey/select_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId })
      });
      fetchStatus();
    }

    async function toggleTrainingMode(enabled) {
      await fetch('/api/survey/training_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
    }

    async function approveDecision() {
      await fetch('/api/survey/approve_step', { method: 'POST' });
      fetchStatus();
    }

    async function overrideDecision() {
      const target = document.getElementById('override-target-input').value;
      const explanation = document.getElementById('rule-explanation-input').value;
      if (!target) return alert('Введіть текст цільового елемента');
      await fetch('/api/survey/override_step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override_target: target, override_action: 'click', explanation })
      });
      document.getElementById('override-target-input').value = '';
      document.getElementById('rule-explanation-input').value = '';
      fetchStatus();
    }

    async function authorizeNow() {
      await fetch('/api/survey/authorize', { method: 'POST' });
      fetchStatus();
    }

    async function stopCurrent() {
      await fetch('/api/survey/stop', { method: 'POST' });
      fetchStatus();
    }

    function openLiveBrowser() {
      const target = {{ (('http://' ~ active_browser_source.host ~ ':' ~ active_browser_source.port) if active_browser_source else '') | tojson }};
      if (!target) {
        alert('Активне джерело браузера не налаштовано (Налаштування → Браузер)');
        return;
      }
      window.open(target, '_blank');
    }

    setInterval(fetchStatus, 800);
    setInterval(refreshScreenshot, 1200);
    fetchStatus();
  </script>
</body>
</html>
"""

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_app(path):
    from flask import send_from_directory
    dist_dir = os.path.join(os.path.dirname(__file__), "web", "dist")
    target_path = os.path.join(dist_dir, path)
    if path and os.path.exists(target_path) and os.path.isfile(target_path):
        return send_from_directory(dist_dir, path)
    # Router-prefixed asset request (e.g. /app/assets/x.js, /survey/app/assets/x.js):
    # Vite hashed filenames are globally unique, so resolve by basename under dist/assets/.
    if path.endswith((".js", ".css", ".map", ".svg", ".png", ".woff", ".woff2")):
        basename = os.path.basename(path)
        asset_path = os.path.join(dist_dir, "assets", basename)
        if os.path.isfile(asset_path):
            return send_from_directory(os.path.join(dist_dir, "assets"), basename)
    return send_from_directory(dist_dir, "index.html")

@app.route("/legacy")
def index():
    from persona_graph_memory import get_active_browser_source
    active_browser_source = get_active_browser_source()
    return render_template_string(ASTRYX_HTML_TEMPLATE, active_browser_source=active_browser_source)


@app.route("/api/survey/screenshot/latest")
def latest_screenshot():
    paths = [os.path.expanduser("~/latest_survey_step.png"), "/home/vokov/latest_survey_step.png"]
    for shot_path in paths:
        if os.path.exists(shot_path):
            resp = send_file(shot_path, mimetype="image/png")
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
            return resp
    return jsonify({"error": "No screenshot available"}), 444

@app.route("/api/survey/status")
def status_api():
    with STATE_LOCK:
        state_copy = dict(ACTIVE_SURVEY_STATE)
        if state_copy["wait_expires_at"]:
            rem = int((state_copy["wait_expires_at"] - datetime.now()).total_seconds())
            state_copy["wait_seconds_remaining"] = max(0, rem)
        else:
            state_copy["wait_seconds_remaining"] = 0
        state_copy.pop("wait_expires_at", None)
        state_copy.pop("trigger_time", None)
        state_copy.pop("verification_event", None)
        state_copy["pending_tasks"] = PENDING_TASKS
        return jsonify(state_copy)

@app.route("/api/survey/fetch_telegram", methods=["POST"])
def fetch_telegram_route():
    payload = request.get_json(silent=True) or request.form.to_dict() or {}
    res = fetch_telegram_api(optional_payload=payload)
    return jsonify(res)

@app.route("/api/survey/telegram_push", methods=["POST"])
def telegram_push_api():
    payload = request.get_json(silent=True) or request.form.to_dict() or {}
    text, url = extract_text_and_url_from_payload(payload)
    if text or url:
        item = record_telegram_push(payload, text, url)
        task_item = push_task_from_text(text or url or "", force=True, override_url=url)
        if task_item:
            return jsonify({"status": "success", "task": task_item, "item": item})
    return jsonify({"status": "error", "message": "Could not parse survey trigger from text"}), 400

@app.route("/api/survey/telegram_queue", methods=["GET"])
def telegram_queue_api():
    with STATE_LOCK:
        listener = dict(TELEGRAM_LISTENER_STATE)
        items = list(reversed(RECENT_TELEGRAM_PUSHES))
    return jsonify({
        "listener": listener,
        "items": items
    })

@app.route("/api/survey/telegram_queue/<update_id>/claim", methods=["POST"])
def claim_telegram_queue_api(update_id):
    target = None
    with STATE_LOCK:
        for item in RECENT_TELEGRAM_PUSHES:
            if str(item.get("update_id")) == str(update_id):
                item["state"] = "claimed"
                target = dict(item)
                break
    if not target:
        return jsonify({"status": "error", "message": f"Item {update_id} not found"}), 404

    text = target.get("text", "")
    url = target.get("url") or "https://meinungsplatz.ch/"
    profile = "annet" if ("Олени" in text or "Annette" in text or "Олена" in text) else "arno"

    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "starting"
        ACTIVE_SURVEY_STATE["profile"] = profile
        ACTIVE_SURVEY_STATE["url"] = url
        ACTIVE_SURVEY_STATE["active_task_id"] = f"telegram_{update_id}"
        ACTIVE_SURVEY_STATE["wait_expires_at"] = None

    add_log(f"⚡ Завдання з Telegram #{update_id} взято в роботу для {PROFILES.get(profile, {}).get('name', profile)} ({url})")
    # Claim = attach to the persona's existing browser tab for this URL first
    # (attach_exact_tab gracefully falls back to a fresh run if no matching
    # tab is open - see survey_agent.py is_active_survey check).
    threading.Thread(target=run_survey_execution, args=(profile, url, url), daemon=True).start()
    return jsonify({"status": "success", "profile": profile, "url": url})

@app.route("/api/survey/telegram_queue/<update_id>/discard", methods=["POST"])
def discard_telegram_queue_api(update_id):
    found = False
    with STATE_LOCK:
        for item in RECENT_TELEGRAM_PUSHES:
            if str(item.get("update_id")) == str(update_id):
                item["state"] = "discarded"
                found = True
                break
    if not found:
        return jsonify({"status": "error", "message": f"Item {update_id} not found"}), 404

    add_log(f"🗑 Завдання з Telegram #{update_id} відхилено (discarded).")
    return jsonify({"status": "success"})

@app.route("/api/survey/select_task", methods=["POST"])
def select_task_api():
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    with STATE_LOCK:
        global PENDING_TASKS
        matching = [t for t in PENDING_TASKS if t["id"] == task_id]
        if matching:
            set_active_task_locked(matching[0])
            PENDING_TASKS = [t for t in PENDING_TASKS if t["id"] != task_id]
            ACTIVE_SURVEY_STATE["status"] = "starting"
            chosen = matching[0]
    if matching:
        add_log(f"⚡ Задачу '{chosen['profile_name']}' вибрано для виконання.")
        threading.Thread(target=run_survey_execution, args=(chosen["profile"], chosen["url"]), daemon=True).start()
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Task not found"}), 404

@app.route("/api/survey/resume_tab", methods=["POST"])
def resume_tab_api():
    data = request.get_json(silent=True) or {}
    profile = data.get("profile")
    tab_url = (data.get("resume_tab_url") or data.get("tab_url") or "").strip()
    if profile not in PROFILES:
        return jsonify({"status": "error", "message": "Unknown profile"}), 400
    if not tab_url:
        return jsonify({"status": "error", "message": "tab_url is required"}), 400
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "starting"
        ACTIVE_SURVEY_STATE["active_task_id"] = None
        ACTIVE_SURVEY_STATE["profile"] = profile
        ACTIVE_SURVEY_STATE["url"] = tab_url
        ACTIVE_SURVEY_STATE["wait_expires_at"] = None
    add_log(f"🔗 Резюм у відкритій вкладці: {PROFILES[profile]['name']} → {tab_url}")
    threading.Thread(target=run_survey_execution, args=(profile, tab_url, tab_url), daemon=True).start()
    return jsonify({"status": "success"})

@app.route("/api/survey/pending_tasks/<task_id>", methods=["DELETE"])
def delete_pending_task_api(task_id: str):
    with STATE_LOCK:
        global PENDING_TASKS
        before = len(PENDING_TASKS)
        PENDING_TASKS = [t for t in PENDING_TASKS if t["id"] != task_id]
        removed = before != len(PENDING_TASKS)
        if removed and ACTIVE_SURVEY_STATE.get("active_task_id") == task_id and ACTIVE_SURVEY_STATE["status"] == "waiting_auth":
            ACTIVE_SURVEY_STATE["status"] = "idle"
            ACTIVE_SURVEY_STATE["active_task_id"] = None
            ACTIVE_SURVEY_STATE["wait_expires_at"] = None
    if removed:
        add_log(f"🗑 Завдання {task_id} видалено з черги.")
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Task not found"}), 404

@app.route("/api/survey/training_mode", methods=["POST"])
def training_mode_api():
    data = request.get_json(silent=True) or {}
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["training_mode"] = bool(data.get("enabled", True))
    add_log(f"🎓 Режим навчання: {'УВІМКНЕНО' if ACTIVE_SURVEY_STATE['training_mode'] else 'ВИМКНЕНО'}")
    return jsonify({"status": "success", "training_mode": ACTIVE_SURVEY_STATE["training_mode"]})

@app.route("/api/survey/verify_step", methods=["POST"])
def verify_step_api():
    data = request.get_json(silent=True) or {}
    with STATE_LOCK:
        training_mode = ACTIVE_SURVEY_STATE["training_mode"]
        ACTIVE_SURVEY_STATE["pending_step"] = data.get("step")
        ACTIVE_SURVEY_STATE["pending_decision"] = data.get("decision")
        ACTIVE_SURVEY_STATE["pending_pattern"] = data.get("pattern")
        ACTIVE_SURVEY_STATE["pending_page_text"] = data.get("page_text", "")
        ACTIVE_SURVEY_STATE["bounding_boxes"] = data.get("bounding_boxes", [])
        ACTIVE_SURVEY_STATE["verification_event"].clear()
        ACTIVE_SURVEY_STATE["verification_result"] = None
        if training_mode:
            ACTIVE_SURVEY_STATE["status"] = "waiting_verification"

    if not training_mode:
        return jsonify({"approved": True})

    add_log(f"⏸️ Крок {data.get('step')}: Очікування верифікації людини у Режимі Навчання...")
    event_set = ACTIVE_SURVEY_STATE["verification_event"].wait(timeout=300)
    
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "running"
        res = ACTIVE_SURVEY_STATE["verification_result"] or {"approved": True}
        ACTIVE_SURVEY_STATE["pending_decision"] = None
        return jsonify(res)

@app.route("/api/survey/approve_step", methods=["POST"])
@app.route("/api/survey/approve", methods=["POST"])
def approve_step_api():
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["verification_result"] = {"approved": True}
        ACTIVE_SURVEY_STATE["verification_event"].set()
    add_log("✅ Затверджено людиною у Режимі Навчання.")
    return jsonify({"status": "success"})

@app.route("/api/survey/skip", methods=["POST"])
def skip_step_api():
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["verification_result"] = {"approved": True, "override_action": "skip"}
        ACTIVE_SURVEY_STATE["verification_event"].set()
    add_log("⏭️ Пропущено людиною у Режимі Навчання.")
    return jsonify({"status": "success"})

@app.route("/api/survey/pause", methods=["POST"])
def pause_step_api():
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "paused"
    add_log("⏸️ Поставлено на паузу оператором.")
    return jsonify({"status": "success"})

@app.route("/api/survey/resume_after_captcha", methods=["POST"])
def resume_after_captcha_api():
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "running"
        ACTIVE_SURVEY_STATE["reason_code"] = None
        ACTIVE_SURVEY_STATE["verification_result"] = {"approved": True}
        ACTIVE_SURVEY_STATE["verification_event"].set()
    add_log("🔓 Капчу підтверджено оператором. Продовження автоматичного опитування...")
    return jsonify({"status": "success", "message": "Resumed after captcha"})

@app.route("/api/survey/abort_task", methods=["POST"])
@app.route("/api/survey/abort", methods=["POST"])
def abort_task_api():
    try:
        with CURRENT_PROC_LOCK:
            proc = CURRENT_PROC
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "idle"
            ACTIVE_SURVEY_STATE["reason_code"] = None
            ACTIVE_SURVEY_STATE["wait_expires_at"] = None
            ACTIVE_SURVEY_STATE["verification_result"] = {"approved": False, "abort": True}
            ACTIVE_SURVEY_STATE["verification_event"].set()
        add_log("🛑 Опитування перервано (aborted) оператором.")
        return jsonify({"status": "success", "message": "Task aborted"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/survey/cdp_emulate", methods=["POST"])
def cdp_emulate_api():
    data = request.get_json(silent=True) or {}
    width = int(data.get("width", 0))
    height = int(data.get("height", 0))
    mobile = bool(data.get("mobile", False))
    try:
        from cdp_client import CDPClient
        client = CDPClient(19225)
        try:
            client.set_device_metrics_override(width, height, mobile=mobile)
            add_log(f"🖥️ Встановлено емуляцію екрана CDP: {width}x{height} (mobile={mobile})")
        finally:
            client.close()
        return jsonify({"status": "success", "width": width, "height": height, "mobile": mobile})
    except Exception as e:
        add_log(f"⚠️ Помилка налаштування емуляції екрана CDP: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/survey/override_step", methods=["POST"])
@app.route("/api/survey/override", methods=["POST"])
def override_step_api():
    data = request.get_json(silent=True) or {}
    target = data.get("override_target", "")
    explanation = data.get("explanation", "")
    profile = ACTIVE_SURVEY_STATE.get("profile") or "arno"
    
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["verification_result"] = {
            "approved": False,
            "override_action": data.get("override_action", "click"),
            "override_target": target,
            "override_value": data.get("override_value", "")
        }
        ACTIVE_SURVEY_STATE["verification_event"].set()

    if target:
        try:
            POSITIONAL_RE = re.compile(r'(every-\d+|item\d+|nth-child|every\s+\d+|option\[\d+\])', re.IGNORECASE)
            confirm_positional = data.get("confirm_positional", False)
            rule_val = f"{target} ({explanation})" if explanation else target

            if POSITIONAL_RE.search(rule_val) and not confirm_positional:
                return jsonify({
                    "error": "positional_heuristic_detected",
                    "message": "Виявлено позиційний селектор (наприклад item30 або every-3rd). Позиційні правила крихкі і можуть зламатися при зміні верстки.",
                    "requires_confirmation": True,
                    "rule_val": rule_val
                }), 422

            pattern = ACTIVE_SURVEY_STATE.get("pending_pattern")
            from persona_graph_memory import record_host_rule, norm_host
            host = norm_host(ACTIVE_SURVEY_STATE.get("url", ""))
            if not pattern:
                slug = re.sub(r"[^a-z0-9]+", "_", target.lower()).strip("_")[:40]
                pattern = f"nav:{slug}" if slug else f"nav:step{data.get('step')}"

            is_fragile = bool(POSITIONAL_RE.search(rule_val))
            task_id = ACTIVE_SURVEY_STATE.get("active_task_id", "")
            evidence = {
                "target": target,
                "explanation": explanation,
                "run_id": task_id,
                "page_text": ACTIVE_SURVEY_STATE.get("pending_page_text", "")[:300],
                "fragile": "positional" if is_fragile else None
            }
            record_host_rule(
                host, 
                pattern, 
                rule_val, 
                persona=profile, 
                source="human_override",
                status="shadow", 
                confidence=0.9,
                evidence=evidence
            )
            add_log(f"🧠 Записано host_rule [{profile}@{host}] (shadow) pattern={pattern}: {rule_val}")
        except Exception as e:
            add_log(f"Помилка запису правила у Graph Memory: {e}")

    add_log(f"✏️ Виправлено людиною: target='{target}'")
    return jsonify({"status": "success"})

@app.route("/api/survey/trigger", methods=["POST"])
def trigger_api():
    data = request.get_json(silent=True) or {}
    profile = data.get("profile", "arno")
    url = data.get("url", "https://meinungsplatz.ch/")
    reward = data.get("reward", "0.9 CHF")
    duration = data.get("duration", "6 min")
    
    task_id = f"task_{profile}_{int(time.time()*1000)}"
    task_item = {
        "id": task_id,
        "profile": profile,
        "profile_name": PROFILES.get(profile, {}).get("name", profile),
        "url": url,
        "reward": reward,
        "duration": duration,
        "created_at": datetime.now().strftime("%H:%M:%S"),
        "wait_expires_at": (datetime.now() + timedelta(minutes=10)).isoformat(),
        "status": "waiting_auth"
    }
    
    with STATE_LOCK:
        PENDING_TASKS.append(task_item)
        set_active_task_locked(task_item)
        
    add_log(f"🔔 АКТИВОВАНО СЦЕНАРІЙ ДЛЯ: {PROFILES.get(profile, {}).get('name', profile)}")
    add_log(f"💰 Винагорода: {reward} | ⏱ Тривалість: {duration}")
    return jsonify({"status": "success", "message": "Trigger received, task queued"})

@app.route("/api/survey/authorize", methods=["POST"])
def authorize_api():
    started = False
    with STATE_LOCK:
        if ACTIVE_SURVEY_STATE["status"] in ("waiting_auth", "idle"):
            profile = ACTIVE_SURVEY_STATE["profile"] or "arno"
            url = ACTIVE_SURVEY_STATE["url"] or "https://meinungsplatz.ch/"
            ACTIVE_SURVEY_STATE["status"] = "starting"
            started = True
    if started:
        add_log("⚡ Авторизація підтверджена! Негайний запуск опитування.")
        threading.Thread(target=run_survey_execution, args=(profile, url), daemon=True).start()
        return jsonify({"status": "success", "message": "Authorized and started"})
    return jsonify({"status": "error", "message": "Invalid state for authorization"}), 400

@app.route("/api/survey/stop", methods=["POST"])
def stop_api():
    try:
        with CURRENT_PROC_LOCK:
            proc = CURRENT_PROC
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
        subprocess.run(["bash", os.path.expanduser("~/llm-switch.sh"), "stop"], capture_output=True)
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "idle"
            ACTIVE_SURVEY_STATE["wait_expires_at"] = None
            ACTIVE_SURVEY_STATE["verification_event"].set()
        add_log("🛑 Процес зупинено за запитом користувача.")
        return jsonify({"status": "success", "message": "Stopped"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    threading.Thread(target=telegram_listener_thread, daemon=True).start()
    threading.Thread(target=auto_start_timer_thread, daemon=True).start()
    port = int(os.environ.get("PORT", 5005))
    try:
        app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
    except Exception as e:
        print(f"Flask server exited: {e}", flush=True)

