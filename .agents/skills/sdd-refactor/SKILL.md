---
name: sdd-refactor
description: Guide and execute the SDD Refactoring / Performance workflow (Template 3) for vydra-swiss-survey — benchmark before and after, no public-contract breaks.
---

# SDD Refactor Skill

When activated for a refactor/optimization task:

1. Read `docs/for-agents/sdd-development-methodology.md`, section "ШАБЛОН 3" (Refactoring & Performance), and follow it literally.
2. Never change a public function signature that has callers in other modules — verify via GitNexus impact analysis first.
3. Benchmark BEFORE: measure current latency distribution (min/median/p95/max) over 20 consecutive calls.
4. Check all callers via `python3 scripts/check_gitnexus_impact.py <symbol>`, then apply the optimization.
5. Benchmark AFTER: same measurement, produce a before/after comparison table.
6. Run `python3 -m pytest tests/` to confirm no regression.
7. Final report must state: benchmark table, impact-analysis output, and whether `bash bin/sdd_verify.sh` passed.
