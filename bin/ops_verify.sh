#!/usr/bin/env bash
# Machine verification script for Feature 021B — Ops Console: Telegram Queue + Resume-in-tab.
set -euo pipefail

BASE="${1:-https://survey.exodus.pp.ua}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO_DIR}/docs/astryx-refactor/evidence/020C-021B"
mkdir -p "$OUT"

echo "=== Astryx 021B Ops Verification Gate ==="
echo "Target Base URL: $BASE"
fail=0

AUTH_COOKIE="astryx_k=oDWnckh7aaA8HOJiskM3uvvmUi7nQFX6"
JS=$(curl -s -b "$AUTH_COOKIE" "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -n1 || true)
if [ -z "$JS" ]; then
  echo "FAIL: No assets/index-*.js found in $BASE/ (authenticated)"
  exit 1
fi
curl -s -b "$AUTH_COOKIE" "$BASE/$JS" -o /tmp/ops_bundle.js
echo "Bundle: $BASE/$JS"

> "$OUT/gate7-ops-tokens.txt"
for token in "telegram-queue" "resume-attach"; do
  n=$(grep -o -F "$token" /tmp/ops_bundle.js | wc -l || true)
  echo "bundle:$token=$n" | tee -a "$OUT/gate7-ops-tokens.txt"
  if [ "$n" -eq 0 ]; then
    echo "FAIL: $token відсутній у задеплоєному бандлі — Telegram Queue / Resume-in-tab UI не задеплоєно"
    fail=1
  fi
done

echo ""
echo "Checking console/API auth gating (no cookie => must be blocked)..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/survey/status")
echo "GET $BASE/api/survey/status (no auth) -> $CODE" | tee -a "$OUT/gate7-ops-tokens.txt"
if [ "$CODE" != "401" ]; then
  echo "FAIL: console API accessible without authorization ($CODE)"
  fail=1
fi

ROOT_TITLE=$(curl -s "$BASE/" | grep -o '<title>[^<]*</title>' | head -n1)
echo "GET $BASE/ (no auth) title -> $ROOT_TITLE" | tee -a "$OUT/gate7-ops-tokens.txt"
if ! echo "$ROOT_TITLE" | grep -qi "вхід\|login"; then
  echo "FAIL: root route does not show login gate without auth (possible console leak)"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "🎉 OPS VERIFICATION PASS"
  exit 0
else
  echo "❌ OPS VERIFICATION FAILED"
  exit 1
fi
