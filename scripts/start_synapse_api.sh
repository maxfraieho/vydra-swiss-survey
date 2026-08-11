#!/data/data/com.termux/files/usr/bin/bash
# scripts/start_synapse_api.sh — Launcher for persistent Synapse HTTP API service on Termux.

PORT=${PORT:-8787}
SYNAPSE_HOST=${SYNAPSE_HOST:-127.0.0.1}
TSX_CLI="$HOME/synapse/node_modules/.pnpm/tsx@4.23.0/node_modules/tsx/dist/cli.mjs"

# Check if service is already running on port
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 "http://${SYNAPSE_HOST}:${PORT}/health" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
    echo "[start_synapse_api] Launching Synapse HTTP API service on http://${SYNAPSE_HOST}:${PORT}..."
    cd "$HOME/synapse/apps/api" && \
    SYNAPSE_EMBED_PROVIDER=hash PORT="$PORT" SYNAPSE_HOST="$SYNAPSE_HOST" \
    setsid nohup node "$TSX_CLI" src/server.ts < /dev/null >> "$HOME/synapse/api.log" 2>&1 &
    
    # Wait up to 5s for health check confirmation
    for i in {1..10}; do
        sleep 0.5
        CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 "http://${SYNAPSE_HOST}:${PORT}/health" 2>/dev/null)
        if [ "$CODE" == "200" ]; then
            echo "[start_synapse_api] Service healthy on http://${SYNAPSE_HOST}:${PORT}"
            exit 0
        fi
    done
    echo "[start_synapse_api] Warning: Service launched but health check pending."
else
    echo "[start_synapse_api] Service already active on http://${SYNAPSE_HOST}:${PORT}"
fi
