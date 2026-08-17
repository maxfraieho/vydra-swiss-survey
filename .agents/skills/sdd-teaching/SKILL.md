---
name: sdd-teaching
description: Guide and execute the SDD Agent Teaching / HITL Rule Formalization workflow (Template 5) for vydra-swiss-survey — shadow rules, N>=3 promotion gate.
---

# SDD Teaching Skill

When activated for a human-in-the-loop teaching/rule-formalization task:

1. Read `docs/for-agents/sdd-development-methodology.md`, section "ШАБЛОН 5" (HITL Agent Teaching), and follow it literally.
2. Human operator corrections have 100% priority over Gemma Vision predictions.
3. Read the latest step log from Astryx UI / `ACTIVE_SURVEY_STATE`, identify the question pattern (e.g. `tobacco`, `household`, `industry_exclusion`).
4. Record a `shadow`-status rule via `record_host_rule(..., status='shadow')` in `persona_graph_memory.py`.
5. New rules start as `shadow`; promotion to `active` happens ONLY via `auto_promote_rules(min_unique_runs=3)`, requiring N>=3 independent completed runs with `wins > (losses * 2)`.
6. `get_host_rules()` calls during a live survey must remain non-blocking (< 5ms) — never add synchronous work to this path.
7. Add a unit test in `tests/unit/test_rules_engine.py` verifying rule selection in the priority cascade.
8. Final report must state: profile/host, the shadow rule recorded, test result, and promotion status.
