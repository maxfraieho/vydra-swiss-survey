#!/usr/bin/env bash
# SDD Verification Script v2 — dynamic spec traversal + gate/arbiter modes
#
# Modes:
#   (no args)  Default: verify every specs/ artifact present on THIS branch.
#              Dynamic — walks specs/*/ instead of a hardcoded per-branch list,
#              so it does not fail when run against a branch with a different
#              set of spec numbers (e.g. master vs astryx-ui-refactor).
#   --gate     L3 Validator Gate: read .specify/feature.json, validate ONLY
#              the active feature's artifacts for its current phase, and
#              confirm the file's `branch` matches the checked-out branch.
#   --arbiter  Run scripts/sdd_llm_judge.py --staged (LLM pre-commit judge),
#              if that script exists yet (P8 — may not be implemented).

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

MODE="default"
case "${1:-}" in
    --gate) MODE="gate" ;;
    --arbiter) MODE="arbiter" ;;
esac

MISSING=0

verify_default() {
    echo "=== SDD Verification Check (dynamic) ==="

    if [ -f ".specify/constitution.md" ]; then
        echo "  ✅ .specify/constitution.md exists"
    else
        echo "  ❌ .specify/constitution.md MISSING"
        MISSING=$((MISSING + 1))
    fi

    # Single-file phase specs (specs/P1-*.md .. P5-*.md style)
    for f in specs/P*.md; do
        [ -e "$f" ] || continue
        if [ -f "$f" ]; then
            echo "  ✅ $f exists"
        else
            echo "  ❌ $f MISSING"
            MISSING=$((MISSING + 1))
        fi
    done

    # Feature directories: specs/<NNN-slug>/ — at least ONE artifact must
    # exist (proves it's a real spec dir, not empty). spec.md is the
    # canonical artifact and gets a WARN (not FAIL) if missing, since some
    # pre-021 specs (e.g. 001-sdd-migration) predate the spec.md convention
    # and only ever had plan.md+tasks.md — don't retroactively break history.
    for dir in specs/*/; do
        [ -d "$dir" ] || continue
        slug="${dir%/}"
        found_any=0
        for artifact in spec.md plan.md tasks.md clarify.md; do
            f="$slug/$artifact"
            if [ -f "$f" ]; then
                echo "  ✅ $f exists"
                found_any=1
            fi
        done
        if [ "$found_any" -eq 0 ]; then
            echo "  ❌ $slug/ is empty — no spec.md/plan.md/tasks.md/clarify.md found"
            MISSING=$((MISSING + 1))
        elif [ ! -f "$slug/spec.md" ]; then
            echo "  ⚠️  $slug/spec.md missing (pre-spec.md-convention legacy spec, not failing)"
        fi
    done

    if [ -d ".claude/commands/sdd" ]; then
        cmd_count=$(find .claude/commands/sdd -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
        echo "  ✅ .claude/commands/sdd/ present ($cmd_count command files)"
    else
        echo "  ⚠️  .claude/commands/sdd/ missing (not fatal on branches that predate it)"
    fi

    if [ -d ".agents/skills" ]; then
        skill_count=$(find .agents/skills -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
        echo "  ✅ .agents/skills/ present ($skill_count skills)"
    fi
}

verify_gate() {
    echo "=== SDD Gate Check (active feature only) ==="
    local fj=".specify/feature.json"

    if [ ! -f "$fj" ]; then
        echo "  ❌ $fj MISSING — cannot gate without an active feature pointer"
        MISSING=$((MISSING + 1))
        return
    fi

    local branch_in_file spec_dir phase current_branch
    branch_in_file=$(python3 -c "import json;print(json.load(open('$fj')).get('branch',''))" 2>/dev/null)
    spec_dir=$(python3 -c "import json;print(json.load(open('$fj')).get('spec_dir',''))" 2>/dev/null)
    phase=$(python3 -c "import json;print(json.load(open('$fj')).get('phase',''))" 2>/dev/null)
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

    if [ "$branch_in_file" != "$current_branch" ]; then
        echo "  ❌ $fj branch mismatch: file says '$branch_in_file', HEAD is '$current_branch'"
        MISSING=$((MISSING + 1))
        return
    fi
    echo "  ✅ branch matches ($current_branch)"

    if [ -z "$spec_dir" ] || [ ! -d "$spec_dir" ]; then
        echo "  ❌ spec_dir '$spec_dir' from $fj does not exist"
        MISSING=$((MISSING + 1))
        return
    fi

    local required=()
    case "$phase" in
        specify) required=(spec.md) ;;
        clarify) required=(spec.md clarify.md) ;;
        plan)    required=(spec.md clarify.md plan.md) ;;
        tasks|implement|verify) required=(spec.md plan.md tasks.md) ;;
        *) required=(spec.md) ;;
    esac

    local r f
    for r in "${required[@]}"; do
        f="$spec_dir/$r"
        if [ -f "$f" ]; then
            echo "  ✅ $f exists (required for phase=$phase)"
        else
            echo "  ❌ $f MISSING (required for phase=$phase)"
            MISSING=$((MISSING + 1))
        fi
    done

    if [ "$phase" = "verify" ] && [ -f "$spec_dir/tasks.md" ]; then
        local unchecked
        unchecked=$(grep -c '^\- \[ \]' "$spec_dir/tasks.md" 2>/dev/null || echo 0)
        if [ "$unchecked" -gt 0 ]; then
            echo "  ❌ $unchecked unfinished task(s) in $spec_dir/tasks.md at phase=verify"
            MISSING=$((MISSING + 1))
        else
            echo "  ✅ all tasks checked in $spec_dir/tasks.md"
        fi
    fi
}

verify_arbiter() {
    echo "=== SDD Arbiter Check ==="
    if [ -f "scripts/sdd_llm_judge.py" ]; then
        python3 scripts/sdd_llm_judge.py --staged
        return $?
    else
        echo "  ⚠️  scripts/sdd_llm_judge.py not implemented yet (P8 pending) — skipping"
        return 0
    fi
}

case "$MODE" in
    gate) verify_gate ;;
    arbiter)
        verify_arbiter
        exit $?
        ;;
    default) verify_default ;;
esac

if [ "$MISSING" -gt 0 ]; then
    echo "=== SDD Verification FAILED ($MISSING issue(s)) ==="
    exit 1
fi

echo "=== SDD Verification Passed ==="
if [ "$MODE" = "default" ] && [ -f "$REPO_DIR/bin/ui_verify.sh" ]; then
    bash "$REPO_DIR/bin/ui_verify.sh"
fi
