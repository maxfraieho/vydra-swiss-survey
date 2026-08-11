#!/usr/bin/env bash
# SDD Verification Script - Verifies presence and structure of SDD spec files
set -euo pipefail

echo "=== SDD Verification Check ==="

MISSING=0

for spec in ".specify/constitution.md" "specs/001-sdd-migration/plan.md" "specs/001-sdd-migration/tasks.md" "specs/002-rules-api/spec.md" "specs/003-async-review-queue/spec.md" "specs/004-astryx-ui-console/spec.md"; do
    if [ -f "$spec" ]; then
        echo "  ✅ $spec exists"
    else
        echo "  ❌ $spec MISSING"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -eq 0 ]; then
    echo "=== All SDD Specifications Verified Successfully ==="
    exit 0
else
    echo "=== SDD Verification FAILED ($MISSING missing specs) ==="
    exit 1
fi
