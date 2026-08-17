---
name: sdd-feature
description: Guide and execute the SDD Feature Development workflow (Template 1) for new features, endpoints, or UI components in vydra-swiss-survey.
---

# SDD Feature Skill

When activated for a new feature task:

1. Read `docs/for-agents/sdd-development-methodology.md`, section "ШАБЛОН 1" (Feature Development), and follow it literally — do not invent your own sequence.
2. Before writing the spec, read `.specify/constitution.md` — invariants (hot path < 5ms, N>=3 rule-promotion gate, SQLite WAL mode, PII policy) must be reflected in `spec.md`.
3. Determine the next free `specs/<NNN>-<slug>/` by running `ls specs/` — never guess the number from memory.
4. Follow the MUST rules in `AGENTS.md` (impact analysis before editing any symbol, `detect_changes()` before commit).
5. Final report must state: files created, `check_gitnexus_impact.py` output, `pytest` output, and whether `bash bin/sdd_verify.sh` passed.
