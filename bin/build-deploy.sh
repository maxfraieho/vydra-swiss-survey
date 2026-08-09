#!/usr/bin/env bash
# Builds the web/ frontend (vite) and confirms dist/ was refreshed.
# Flask (astryx_survey_server.py) serves web/dist/ directly via
# send_from_directory — no server restart needed after a build.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/vydra-swiss-survey}"
WEB_DIR="${REPO_DIR}/web"
DIST_DIR="${WEB_DIR}/dist"
DEPLOY_LOG="${REPO_DIR}/deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEPLOY_LOG"
    echo "$1"
}

if [ ! -d "$WEB_DIR" ]; then
    log "FATAL: $WEB_DIR not found"
    exit 1
fi

log "BUILD START"
cd "$WEB_DIR"

if ! npm run build; then
    log "BUILD FAILED"
    exit 1
fi

BUNDLE_JS=$(find "$DIST_DIR/assets" -maxdepth 1 -name 'index-*.js' 2>/dev/null | head -1)
if [ -z "$BUNDLE_JS" ] || [ ! -f "$BUNDLE_JS" ]; then
    log "BUILD ERROR: no dist/assets/index-*.js produced"
    exit 1
fi

log "BUILD OK: $(basename "$BUNDLE_JS")"
log "DEPLOYED: dist/ live, Flask serves it directly, no restart needed"
