# 🤖 AI AGENT DEPLOYMENT INSTRUCTIONS & PROMPT

> **Target Audience:** AI Coding Agents (Antigravity `agy`, Claude Code, Subagents) & Systems Operators  
> **Repository:** `vydra-swiss-survey`  
> **Deployment Suite Location:** [`deploy/`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/)  

---

## 📋 ROLE & MISSION FOR THE AI AGENT

You are an autonomous AI deployment agent (`agy` / `claude`). Your task is to provision, install, build, and verify the `vydra-swiss-survey` system on a target remote Linux server (such as an Oracle Cloud Free Tier Ubuntu 22.04/24.04 LTS ARM64 or x86_64 VPS instance) with 100% automation and zero manual guessing.

---

## ⚡ STEP-BY-STEP AGENT EXECUTION PROTOCOL

### Step 1: Clone Repository & Navigate to Target Directory
```bash
git clone https://github.com/maxfraieho/vydra-swiss-survey.git
cd vydra-swiss-survey
```

### Step 2: Run Universal Automated Deployment Script
Execute the universal deployment script from the `deploy/` directory:
```bash
bash deploy/install.sh
```

*What `deploy/install.sh` automatically handles:*
- Detects OS (`Ubuntu`, `Debian`, `Arch`, `Fedora`) and CPU Architecture (`aarch64` ARM64 / `x86_64`).
- Installs system dependencies: `Python 3.11+`, `pip`, `venv`, `Node.js 20 LTS`, `sqlite3`, `chromium`.
- Provisions Python virtual environment `.venv` and installs `requirements.txt`.
- Initializes SQLite WAL mode at `~/.vydra-survey-profiles/survey_graph.db`.
- Builds production React Web UI bundle (`npm run build` in `web/`).
- Generates and enables `astryx-survey.service` systemd service on Linux VPS.

---

### Step 3: Configure Environment Variables & Secrets (Optional)
If configuring Telegram Bot notifications or custom API tokens, **use your own bot
token** — never copy an example value from this file into a live deployment:
```bash
python3 -c "
import persona_graph_memory
persona_graph_memory.save_setting('telegram_bot_token', '<YOUR_BOT_TOKEN_HERE>')
persona_graph_memory.save_setting('telegram_chat_id', '<YOUR_CHAT_ID_HERE>')
print('Telegram credentials configured!')
"
```
Preferred: set `TELEGRAM_BOT_TOKEN` as an environment variable instead (takes
priority over the DB setting, see `get_telegram_bot_token()` in
`astryx_survey_server.py`) — keeps the secret out of the SQLite file entirely.

---

### Step 4: Execute Health Verification
Run the verification check script to confirm 100% operational status:
```bash
bash deploy/verify_installation.sh
```

---

## 🎯 REPORTING TO THE USER

Upon completion, report:
1. **Server Target & Architecture:** (e.g. `Ubuntu 24.04 LTS (aarch64 Ampere ARM64)`).
2. **Web Console URL:** `http://<SERVER_IP>:5005`
3. **API Status Endpoint:** `http://<SERVER_IP>:5005/api/survey/status`
4. **Health Check Output:** Result of `deploy/verify_installation.sh`.
