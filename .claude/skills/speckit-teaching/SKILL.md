---
name: speckit-teaching
description: SDD workflow for HITL Agent Teaching, human overrides, shadow rule authoring, and N>=3 promotion verification.
---

# Speckit Agent Teaching & Rule Authoring Skill

This skill defines the Spec-Driven Teaching paradigm for `vydra-swiss-survey`, covering human-in-the-loop (HITL) step overrides, shadow rule recording, and empirical rule promotion gates.

## Core Teaching Invariants
1. **Human Choice Overrides Vision:** When an operator provides a step override in Astryx UI (`/api/survey/override_step`), the human decision takes 100% precedence over vision model predictions.
2. **Shadow Gate First:** New rules learned during training MUST be recorded as `status='shadow'` with `confidence < 1.0` in `persona_graph_memory.py`.
3. **N >= 3 Promotion Invariant:** A shadow rule can ONLY be promoted to `status='active'` when `auto_promote_rules(min_unique_runs=3)` verifies clean success across N >= 3 distinct `run_id` executions.
4. **Hot Path Zero-Overhead:** Rule evaluation during live runs MUST take < 5ms via SQLite WAL queries (`get_host_rules()`).

## Teaching Workflow Lifecycle
1. **Signal Capture:** Human operator enters correction in Astryx UI or training mode.
2. **Shadow Rule Authoring:** Call `record_host_rule(host, pattern, behavior, persona, source='human_override', status='shadow')`.
3. **Outcome Tracking:** During subsequent runs, `bump_rule_outcome([rule_id], outcome, run_id)` updates wins/losses and logs `rule_applications`.
4. **Empirical Promotion:** `auto_promote_rules(min_unique_runs=3)` promotes qualified rules to active.
