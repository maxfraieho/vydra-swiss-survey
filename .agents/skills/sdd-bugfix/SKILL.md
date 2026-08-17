---
name: sdd-bugfix
description: Guide and execute the SDD Bug Fix / Incident workflow (Template 2) for vydra-swiss-survey — root-cause first, RED test before any fix.
---

# SDD Bugfix Skill

When activated for a bug/incident task:

1. Read `docs/for-agents/sdd-development-methodology.md`, section "ШАБЛОН 2" (Bug Fix / Incident), and follow it literally.
2. Read `docs/for-agents/debugging-playbook.md` if present — root cause first, exact `file:line`, no silent `try/except: pass` masking.
3. Create `tests/regression/test_<issue_name>.py` that reproduces the bug. Run `python3 -m pytest tests/` — the test MUST fail (RED) before touching implementation code.
4. Check blast radius via `python3 scripts/check_gitnexus_impact.py <symbol>` before the point-fix.
5. Confirm the regression test goes GREEN and the rest of the suite still passes.
6. Final report must state: root cause (`file:line`), the RED→GREEN test name, impact-analysis output, and whether `bash bin/sdd_verify.sh` passed.
