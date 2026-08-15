#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://survey.exodus.pp.ua}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO_DIR}/docs/astryx-refactor/evidence/020C"
mkdir -p "$OUT"

echo "=== Astryx 020 Deploy Verification Gate ==="
echo "Target Base URL: $BASE"

JS=$(curl -s "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -n1 || true)
if [ -z "$JS" ]; then
  echo "FAIL: No assets/index-*.js found in $BASE/" | tee "$OUT/21-deploy_verify.txt"
  exit 1
fi

echo "Fetching bundle: $BASE/$JS"
curl -s "$BASE/$JS" -o /tmp/bundle.js

fail=0
> "$OUT/10-bundle-tokens.txt"
for token in "view=fullscreen" "reason_code"; do
  n=$(grep -o -F "$token" /tmp/bundle.js | wc -l || true)
  echo "bundle:$token=$n" | tee -a "$OUT/10-bundle-tokens.txt"
  if [ "$n" -eq 0 ]; then
    echo "FAIL: $token відсутній у задеплоєному бандлі" | tee -a "$OUT/21-deploy_verify.txt"
    fail=1
  fi
done

echo "Running DOM Probe via CDP..."
if node "${REPO_DIR}/bin/dom_probe.mjs" "$BASE" | tee "$OUT/11-dom-probe.json"; then
  echo "DOM Probe: PASS" | tee -a "$OUT/21-deploy_verify.txt"
else
  echo "DOM Probe: FAIL" | tee -a "$OUT/21-deploy_verify.txt"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "🎉 DEPLOY VERIFICATION PASS" | tee -a "$OUT/21-deploy_verify.txt"
  exit 0
else
  echo "❌ DEPLOY VERIFICATION FAILED" | tee -a "$OUT/21-deploy_verify.txt"
  exit 1
fi
