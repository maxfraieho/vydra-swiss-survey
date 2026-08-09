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

# Vite strips custom attrs (data-cfasync) from the entry <script type="module">
# tag during build, so the source-level fix in web/index.html never survives
# into dist/. Without this, Cloudflare Rocket Loader rewrites type="module"
# into type="<hash>-module", the browser ignores the tag, and the SPA never
# mounts (blank dark screen on every route).
INDEX_HTML="$DIST_DIR/index.html"
MODULE_TAG_PATTERN='<script type="module" crossorigin src="[^"]*" data-cfasync="false"></script>'
if command grep -qE "$MODULE_TAG_PATTERN" "$INDEX_HTML"; then
    log "PATCH SKIP: module script tag already has data-cfasync"
elif command grep -q '<script type="module" crossorigin src="[^"]*"></script>' "$INDEX_HTML"; then
    sed -i 's#<script type="module" crossorigin src="\([^"]*\)"></script>#<script type="module" crossorigin src="\1" data-cfasync="false"></script>#' "$INDEX_HTML"
    if ! command grep -qE "$MODULE_TAG_PATTERN" "$INDEX_HTML"; then
        log "PATCH FAILED: module script tag lacks data-cfasync after sed"
        exit 1
    fi
    log "PATCH OK: data-cfasync=\"false\" injected on module script tag (Rocket Loader guard)"
else
    log "PATCH FAILED: expected module script tag not found in $INDEX_HTML"
    exit 1
fi

log "DEPLOYED: dist/ live, Flask serves it directly, no restart needed"
