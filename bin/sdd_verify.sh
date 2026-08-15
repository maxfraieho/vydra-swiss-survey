#!/usr/bin/env bash
# SDD Verification Script - Verifies presence and structure of SDD spec files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== SDD Verification Check ==="

MISSING=0

REQUIRED_SPECS=(
    ".specify/constitution.md"
    "specs/001-sdd-migration/plan.md"
    "specs/001-sdd-migration/tasks.md"
    "specs/002-rules-api/spec.md"
    "specs/002-synapse-integration/spec.md"
    "specs/003-async-review-queue/spec.md"
    "specs/004-astryx-ui-console/spec.md"
    "specs/005-tutor-live-activity/spec.md"
    "specs/006-tutor-interactive-loop/spec.md"
    "specs/P1-diacritics-normalization.md"
    "specs/P2-tutor-friction-reduction.md"
    "specs/P3-rule-isolation-providers.md"
    "specs/P4-vision-cot-prompting.md"
    "specs/P5-self-healing-resilience.md"
    "specs/007-universal-deploy-suite/spec.md"
    "specs/008-fallback-browser-sources/spec.md"
    "specs/009-sdd-research-command/spec.md"
    ".claude/commands/sdd/research.md"
    "specs/010-sdd-expanded-commands/spec.md"
    ".claude/commands/sdd/clarify.md"
    ".claude/commands/sdd/audit.md"
    ".claude/commands/sdd/verify.md"
    "specs/011-impeccable-design-integration/spec.md"
    "specs/012-astryx-framework-ui-audit/spec.md"
    "specs/013-impeccable-astryx-ui-overhaul/spec.md"
    "specs/014-impeccable-official-ui-critique/spec.md"
    "specs/015-rules-db-synapse-restore-bugfix/spec.md"
    "specs/016-telegram-task-fetch-bugfix/spec.md"
    "specs/020-ops-viewport-and-tabs/spec.md"
    "specs/020-ops-viewport-and-tabs/plan.md"
    "specs/020-ops-viewport-and-tabs/tasks.md"
)

for spec in "${REQUIRED_SPECS[@]}"; do
    if [ -f "$spec" ]; then
        echo "  ✅ $spec exists"
    else
        echo "  ❌ $spec MISSING"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo "=== SDD Verification FAILED ($MISSING missing specs) ==="
    exit 1
fi

echo "=== All SDD Specifications Verified Successfully ==="
bash "$REPO_DIR/bin/ui_verify.sh"
