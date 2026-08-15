#!/usr/bin/env bash
# Machine verification script for Astryx UI Invariants (Feature 020)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_SRC="${REPO_DIR}/web/src"

echo "=== UI Invariant Verification Check ==="
FAILURES=0

# INV-1: 0 HEX literals in web/src/**/*.tsx
echo -n "Checking INV-1 (0 HEX literals in .tsx)... "
HEX_COUNT=$(grep -rohE '#[0-9a-fA-F]{6}' "$WEB_SRC" --include="*.tsx" 2>/dev/null | wc -l || true)
if [ "$HEX_COUNT" -eq 0 ]; then
    echo "✅ PASS (0 HEX found)"
else
    echo "❌ FAIL ($HEX_COUNT HEX literals found)"
    FAILURES=$((FAILURES + 1))
fi

# INV-2: sum of style={{ in web/src/**/*.tsx <= 17
echo -n "Checking INV-2 (style={{ occurrences <= 17)... "
STYLE_COUNT=$(grep -roh 'style={{' "$WEB_SRC" --include="*.tsx" 2>/dev/null | wc -l || true)
if [ "$STYLE_COUNT" -le 17 ]; then
    echo "✅ PASS ($STYLE_COUNT style={{ found, target <= 17)"
else
    echo "❌ FAIL ($STYLE_COUNT style={{ found, target <= 17)"
    FAILURES=$((FAILURES + 1))
fi

# INV-3: No .tsx file in screens or ops > 250 lines
echo -n "Checking INV-3 (Max 250 lines per .tsx file in screens/ and ops/)... "
LONG_FILES=0
while IFS= read -r f; do
    [ -z "$f" ] && continue
    lines=$(wc -l < "$f")
    if [ "$lines" -gt 250 ]; then
        echo -e "\n   ⚠️ File exceeds 250 lines: $f ($lines lines)"
        LONG_FILES=$((LONG_FILES + 1))
    fi
done < <(find "$WEB_SRC/screens" "$WEB_SRC/ops" -type f -name "*.tsx" 2>/dev/null || true)

if [ "$LONG_FILES" -eq 0 ]; then
    echo "✅ PASS (All files <= 250 lines)"
else
    echo "❌ FAIL ($LONG_FILES files exceed 250 lines)"
    FAILURES=$((FAILURES + 1))
fi

# INV-7: 0 fontSize: 9px|10px|11px in web/src/**/*.tsx
echo -n "Checking INV-7 (0 fontSize < 12px in .tsx)... "
FONT_SUB_12=$(grep -rohE 'fontSize:\s*["\x27]?(9|10|11)px' "$WEB_SRC" --include="*.tsx" 2>/dev/null | wc -l || true)
if [ "$FONT_SUB_12" -eq 0 ]; then
    echo "✅ PASS (0 sub-12px font sizes found)"
else
    echo "❌ FAIL ($FONT_SUB_12 sub-12px font sizes found)"
    FAILURES=$((FAILURES + 1))
fi

# INV-8: Agent contract schema & types exist
echo -n "Checking INV-8 (Agent contract schema and TypeScript definitions)... "
if [ -f "$REPO_DIR/specs/020-ops-viewport-and-tabs/contracts/agent_intent.schema.json" ] && [ -f "$WEB_SRC/types/agent.ts" ]; then
    echo "✅ PASS (Contract schema & types present)"
else
    echo "❌ FAIL (Missing contract schema or types)"
    FAILURES=$((FAILURES + 1))
fi

echo "========================================"
if [ "$FAILURES" -eq 0 ]; then
    echo "🎉 ALL UI INVARIANTS PASS"
    exit 0
else
    echo "⚠️ UI INVARIANTS FAILED ($FAILURES failures)"
    exit 1
fi
