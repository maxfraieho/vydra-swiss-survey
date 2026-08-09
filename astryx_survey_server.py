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

app = Flask(__name__)
app.secret_key = "astryx_swiss_survey_secret_key_5005"
app.register_blueprint(auth_bp)
app.register_blueprint(rules_bp)
app.register_blueprint(settings_bp)


@app.before_request
def global_auth_gate():
    if request.path in ("/api/auth", "/api/auth/logout"):
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

    if request.path.endswith((".js", ".css", ".map", ".svg", ".png", ".woff", ".woff2")):
        resp = make_response("", 404)
        resp.headers["Cache-Control"] = "no-store"
        return resp

    resp = make_response(render_template("gate.html"), 200)
    resp.headers["Cache-Control"] = "no-store, must-revalidate"
    resp.headers["Vary"] = "Cookie"
    return resp

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8090499262:AAEQkYpCcWX-BYjHe3psjJsOxDM_K87X5ok")

PROFILES = {
    "arno": {"name": "Арсен", "label": "Arno (Арсен)"},
    "annette": {"name": "Олена", "label": "Annette (Олена)"}
}

PENDING_TASKS = []
CURRENT_PROC = None
CURRENT_PROC_LOCK = threading.Lock()

ACTIVE_SURVEY_STATE = {
    "status": "idle", # idle, waiting_auth, running, waiting_verification, finished, error
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
    "verification_event": threading.Event(),
    "verification_result": None,
    "log_history": [],
    "last_error": None
}

STATE_LOCK = threading.Lock()

def add_log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry, flush=True)
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["log_history"].append(entry)
        if len(ACTIVE_SURVEY_STATE["log_history"]) > 200:
            ACTIVE_SURVEY_STATE["log_history"].pop(0)

def fetch_telegram_api():
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            count = 0
            if data.get("ok"):
                for update in data.get("result", []):
                    msg = update.get("message") or update.get("channel_post") or {}
                    text = msg.get("text", "")
                    if text:
                        push_task_from_text(text)
                        count += 1
            return {"status": "success", "processed": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def push_task_from_text(text: str):
    profile = None
    if "Арсена" in text or "Arno" in text or "Арсен" in text:
        profile = "arno"
    elif "Олени" in text or "Annette" in text or "Олена" in text:
        profile = "annette"
        
    if not profile:
        return None
        
    reward_match = re.search(r'([\d\.]+\s*CHF)', text)
    reward = reward_match.group(1) if reward_match else "1.0 CHF"
    
    duration_match = re.search(r'([\d\.]+\s*min)', text)
    duration = duration_match.group(1) if duration_match else "10 min"
    
    url_match = re.search(r'(https?://[^\s]+)', text)
    survey_url = url_match.group(1) if url_match else "https://meinungsplatz.ch/"
    
    task_id = f"task_{profile}_{int(time.time()*1000)}"
    task_item = {
        "id": task_id,
        "profile": profile,
        "profile_name": PROFILES[profile]["name"],
        "url": survey_url,
        "reward": reward,
        "duration": duration,
        "created_at": datetime.now().strftime("%H:%M:%S"),
        "wait_expires_at": (datetime.now() + timedelta(minutes=10)).isoformat(),
        "status": "waiting_auth"
    }
    
    with STATE_LOCK:
        # Avoid duplicate task entries
        existing = [t for t in PENDING_TASKS if t["profile"] == profile and t["reward"] == reward and t["status"] == "waiting_auth"]
        if not existing:
            PENDING_TASKS.append(task_item)
            
            # If system is idle, set as active
            if ACTIVE_SURVEY_STATE["status"] in ("idle", "finished", "error"):
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
    add_log("🤖 Telegram-бот слухач активний (Token: 8090499262:AAE...).")
    last_update_id = 0
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    
    while True:
        try:
            params = urllib.parse.urlencode({"offset": last_update_id + 1, "timeout": 20})
            req = urllib.request.Request(f"{url}?{params}")
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("ok"):
                    for update in data.get("result", []):
                        last_update_id = update["update_id"]
                        msg = update.get("message") or update.get("channel_post") or {}
                        text = msg.get("text", "")
                        if text:
                            push_task_from_text(text)
        except Exception:
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

def run_survey_execution(profile: str, url: str):
    global CURRENT_PROC
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "running"

    add_log(f"🚀 Ексклюзивний запуск Gemma 3 4B Survey Agent for {profile}...")
    try:
        cmd = ["bash", os.path.expanduser("~/llm-switch.sh"), "survey", profile, url, "-f"]
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
          🌐 Live CDP Браузер (Порт 9226)
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
      window.open('http://192.168.3.184:9226', '_blank');
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
    return render_template_string(ASTRYX_HTML_TEMPLATE)


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
    res = fetch_telegram_api()
    return jsonify(res)

@app.route("/api/survey/telegram_push", methods=["POST"])
def telegram_push_api():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    if text:
        task_item = push_task_from_text(text)
        if task_item:
            return jsonify({"status": "success", "task": task_item})
    return jsonify({"status": "error", "message": "Could not parse survey trigger from text"}), 400

@app.route("/api/survey/select_task", methods=["POST"])
def select_task_api():
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    with STATE_LOCK:
        matching = [t for t in PENDING_TASKS if t["id"] == task_id]
        if matching:
            set_active_task_locked(matching[0])
            ACTIVE_SURVEY_STATE["status"] = "starting"
            chosen = matching[0]
    if matching:
        add_log(f"⚡ Задачу '{chosen['profile_name']}' вибрано для виконання.")
        threading.Thread(target=run_survey_execution, args=(chosen["profile"], chosen["url"]), daemon=True).start()
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
def approve_step_api():
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["verification_result"] = {"approved": True}
        ACTIVE_SURVEY_STATE["verification_event"].set()
    add_log("✅ Затверджено людиною у Режимі Навчання.")
    return jsonify({"status": "success"})

@app.route("/api/survey/override_step", methods=["POST"])
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
            sys.path.insert(0, os.path.expanduser("~/vydra-swiss-survey"))
            rule_val = f"{target} ({explanation})" if explanation else target
            pattern = ACTIVE_SURVEY_STATE.get("pending_pattern")
            if pattern:
                from persona_graph_memory import record_host_rule, norm_host
                host = norm_host(ACTIVE_SURVEY_STATE.get("url", ""))
                record_host_rule(host, pattern, rule_val, persona=profile, source="human_override",
                                  status="active", confidence=0.9,
                                  evidence={"target": target, "explanation": explanation,
                                            "page_text": ACTIVE_SURVEY_STATE.get("pending_page_text", "")[:300]})
                add_log(f"🧠 Записано host_rule [{profile}@{host}] pattern={pattern}: {rule_val}")
            else:
                from persona_graph_memory import record_fact
                topic = f"rule_{int(time.time())}"
                record_fact(profile, topic, rule_val, ACTIVE_SURVEY_STATE.get("url", ""))
                add_log(f"🧠 Записано нове правило в Graph Memory [{profile}]: {topic} = {rule_val}")
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
    app.run(host="0.0.0.0", port=5005, debug=False)
