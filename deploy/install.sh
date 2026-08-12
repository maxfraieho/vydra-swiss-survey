#!/usr/bin/env bash
# ==============================================================================
# Universal Automated Deployment Script for Vydra Swiss Survey Agent
# ==============================================================================
# Supports: Ubuntu 22.04 / 24.04 LTS (Oracle Cloud Free Tier ARM64 & x86_64),
#           Debian 11/12, Fedora/RHEL, Arch Linux, Termux Android.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROFILES_DIR="$HOME/.vydra-survey-profiles"
DB_PATH="$PROFILES_DIR/survey_graph.db"
VENV_DIR="$REPO_DIR/.venv"
LOG_FILE="$REPO_DIR/deploy.log"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" | tee -a "$LOG_FILE"
}

log "=== VYDRA SWISS SURVEY AGENT: UNIVERSAL DEPLOYMENT START ==="
log "Repo Directory: $REPO_DIR"

# 1. Architecture & OS Detection
ARCH="$(uname -m)"
OS_TYPE="unknown"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_TYPE="$ID"
fi

log "Detected OS: $OS_TYPE | Architecture: $ARCH"

# 2. System Package Installation (Ubuntu / Debian / Fedora / Arch)
log "Step 1/6: Installing required system dependencies..."

if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq || true
    sudo apt-get install -y -qq \
        python3 python3-venv python3-pip curl git sqlite3 \
        build-essential libssl-dev ffmpeg ca-certificates \
        chromium-browser || sudo apt-get install -y -qq chromium || true
elif command -v dnf &>/dev/null; then
    sudo dnf install -y python3 python3-pip curl git sqlite3 chromium || true
elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm python python-pip curl git sqlite3 chromium || true
elif command -v pkg &>/dev/null; then
    pkg install -y python nodejs git sqlite || true
fi

# 3. Node.js 20+ Installation Check
log "Step 2/6: Verifying Node.js environment..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 18 ]; then
    log "Installing Node.js 20 LTS..."
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
    fi
fi
log "Node.js Version: $(node -v 2>/dev/null || echo 'N/A')"

# 4. Python Virtual Environment Setup
log "Step 3/6: Provisioning Python virtual environment (.venv)..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
if [ -f "$REPO_DIR/requirements.txt" ]; then
    pip install -r "$REPO_DIR/requirements.txt" -q
fi

# 5. SQLite Profile Directory & Database Initialization
log "Step 4/6: Initializing profiles directory and SQLite WAL database..."
mkdir -p "$PROFILES_DIR"

python3 -c "
import sqlite3, persona_graph_memory
conn = sqlite3.connect('$DB_PATH')
conn.execute('PRAGMA journal_mode=WAL')
conn.execute('PRAGMA busy_timeout=5000')
conn.commit()
conn.close()
persona_graph_memory.init_db()
persona_graph_memory.seed_providers()
print('SQLite WAL initialized successfully at $DB_PATH')
"

# 6. Web UI Production Build
log "Step 5/6: Building production React Web UI bundle..."
if [ -d "$REPO_DIR/web" ]; then
    cd "$REPO_DIR/web"
    npm install --quiet || npm install
    npm run build
    cd "$REPO_DIR"
fi

# 7. Systemd Service Creation (Ubuntu / Linux VPS)
log "Step 6/6: Configuring systemd service astryx-survey.service..."
if command -v systemctl &>/dev/null && [ -d /etc/systemd/system ]; then
    SYSTEMD_SERVICE="/etc/systemd/system/astryx-survey.service"
    SERVICE_CONTENT="[Unit]
Description=Astryx Vydra Survey Agent Background Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$REPO_DIR
ExecStart=$VENV_DIR/bin/python3 $REPO_DIR/astryx_survey_server.py
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target"

    echo "$SERVICE_CONTENT" | sudo tee "$SYSTEMD_SERVICE" > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable astryx-survey.service
    sudo systemctl restart astryx-survey.service || true
    log "Systemd service astryx-survey.service created and enabled!"
else
    log "Systemd not available or non-root context. Starting background process with nohup..."
    pkill -f 'astryx_survey_serve[r]\.py' || true
    sleep 1
    nohup "$VENV_DIR/bin/python3" "$REPO_DIR/astryx_survey_server.py" >> "$LOG_FILE" 2>&1 &
fi

log "=== UNIVERSAL DEPLOYMENT COMPLETE SUCCESSFULLY ==="
log "Web Console API: http://127.0.0.1:5005"
