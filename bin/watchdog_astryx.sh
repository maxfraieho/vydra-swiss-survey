#!/usr/bin/env bash
# Keeps astryx_survey_server.py running. Checks every CHECK_INTERVAL seconds;
# if the process is dead, restarts it and logs the restart (never silent).
set -uo pipefail

REPO_DIR="${REPO_DIR:-$HOME/vydra-swiss-survey}"
SERVER_SCRIPT="astryx_survey_server.py"
SERVER_LOG="${REPO_DIR}/astryx_server.log"
WATCHDOG_LOG="${REPO_DIR}/watchdog.log"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5005/}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$WATCHDOG_LOG"
}

is_alive() {
    pgrep -f 'astryx_survey_serve[r]\.py' >/dev/null 2>&1
}

start_server() {
    cd "$REPO_DIR" || { log "FATAL: cannot cd to $REPO_DIR"; return 1; }
    nohup python3 "$SERVER_SCRIPT" >> "$SERVER_LOG" 2>&1 &
    disown
    sleep 2
    if is_alive; then
        log "RESTARTED: server up, pid=$(pgrep -f 'astryx_survey_serve[r]\.py' | tr '\n' ' ')"
    else
        log "ERROR: restart attempt failed, process not found after start"
    fi
}

log "WATCHDOG STARTED: pid=$$, interval=${CHECK_INTERVAL}s, repo=$REPO_DIR"

while true; do
    if ! is_alive; then
        log "DOWN: astryx_survey_server.py not running, restarting"
        start_server
    fi
    sleep "$CHECK_INTERVAL"
done
