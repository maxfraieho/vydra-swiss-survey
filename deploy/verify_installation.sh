#!/usr/bin/env bash
# ==============================================================================
# Health Check Verification Script for Vydra Swiss Survey Agent
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROFILES_DIR="$HOME/.vydra-survey-profiles"
DB_PATH="$PROFILES_DIR/survey_graph.db"
VENV_PYTHON="$REPO_DIR/.venv/bin/python3"

echo "=== HEALTH VERIFICATION CHECK ==="
ERRORS=0

# 1. Check SQLite Database & WAL Mode
if [ -f "$DB_PATH" ]; then
    WAL_MODE=$(python3 -c "import sqlite3; c=sqlite3.connect('$DB_PATH'); print(c.execute('PRAGMA journal_mode').fetchone()[0])" 2>/dev/null || echo "error")
    if [ "$WAL_MODE" = "wal" ]; then
        echo "  ✅ SQLite DB exists and in WAL mode ($DB_PATH)"
    else
        echo "  ⚠️ SQLite DB journal_mode: $WAL_MODE (expected WAL)"
    fi
else
    echo "  ❌ SQLite DB missing at $DB_PATH"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check Python Dependencies (Venv or System Python)
PYTHON_BIN=""
if [ -x "$VENV_PYTHON" ]; then
    PYTHON_BIN="$VENV_PYTHON"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
fi

if [ -n "$PYTHON_BIN" ]; then
    if "$PYTHON_BIN" -c "import requests, websocket, flask" 2>/dev/null; then
        echo "  ✅ Python dependencies verified ($PYTHON_BIN)"
    else
        echo "  ❌ Python missing required packages ($PYTHON_BIN)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  ❌ Python binary not found"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check React Web UI Build (dist/)
if [ -f "$REPO_DIR/web/dist/index.html" ]; then
    echo "  ✅ Production Web UI bundle verified (web/dist/index.html)"
else
    echo "  ❌ Production Web UI bundle missing at web/dist/index.html"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check Server HTTP Status
STATUS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5005/api/survey/status 2>/dev/null || echo "000")
if [ "$STATUS_HTTP" = "200" ]; then
    echo "  ✅ Astryx Survey Server active on http://127.0.0.1:5005 (HTTP 200)"
else
    echo "  ⚠️ Astryx Survey Server HTTP status: $STATUS_HTTP"
fi

if [ "$ERRORS" -eq 0 ]; then
    echo "=== ALL HEALTH CHECKS PASSED SUCCESSFULLY ==="
    exit 0
else
    echo "=== HEALTH CHECK FAILED WITH $ERRORS ERRORS ==="
    exit 1
fi
