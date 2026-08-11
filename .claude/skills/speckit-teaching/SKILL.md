---
name: speckit-teaching
description: SDD workflow for HITL Agent Teaching, high-level agent telemetry, human overrides, shadow rule authoring, and N>=3 promotion verification.
---

# Speckit Agent Teaching & Rule Authoring Skill

This skill defines the Spec-Driven Teaching paradigm for `vydra-swiss-survey`, covering high-level agent (AntiGravity, Claude, Agy) survey automation, live UI telemetry, human-in-the-loop (HITL) step overrides, shadow rule recording, and empirical rule promotion gates.

## Core Teaching Invariants
1. **High-Level Agent Live Telemetry:** Any high-level AI agent (AntiGravity / Claude / Agy) executing a survey pass MUST update `tutor_activity` telemetry via `POST /api/survey/override_step` or server API. This streams real-time status to the **"🎓 Активність Тутора Навчання"** UI card.
2. **Human Choice Overrides Vision:** When a human tutor provides a step override in Astryx UI (`POST /api/survey/override_step`), the human decision takes 100% precedence over vision model predictions and agent decisions.
3. **Shadow Gate First:** New rules learned during training MUST be recorded as `status='shadow'` with `confidence < 1.0` in `persona_graph_memory.py`.
4. **N >= 3 Promotion Invariant:** A shadow rule can ONLY be promoted to `status='active'` when `auto_promote_rules(min_unique_runs=3)` verifies clean success across N >= 3 distinct `run_id` executions.
5. **Hot Path Zero-Overhead:** Rule evaluation during live runs MUST take < 5ms via SQLite WAL queries (`get_host_rules()`).

## Interactive Tutor UI Protocol
When taking surveys in teaching mode:
- **Decision Source Badges:** Report one of `Human Override`, `Shadow Rule`, `Active Rule`, `Vision Model`, or `Tutor Ready`.
- **Matched Pattern & Behavior:** Publish exact DOM pattern description and chosen click/input behavior to telemetry.
- **Interactive HITL Buttons:** High-level agents listen for human operator commands from the UI:
  - `✅ Підтвердити правило` -> Promotes rule to active state.
  - `✏️ Змінити дію` -> Applies human override action.
  - `⏭️ Передати тутору` -> Pauses agent for tutor guidance.

## Teaching Workflow Lifecycle
1. **Signal Capture & Telemetry Update:** High-level agent or human tutor updates `tutor_activity` telemetry.
2. **Shadow Rule Authoring:** Call `record_host_rule(host, pattern, behavior, persona, source='human_override', status='shadow')`.
3. **Outcome Tracking:** During subsequent runs, `bump_rule_outcome([rule_id], outcome, run_id)` updates wins/losses and logs `rule_applications`.
4. **Empirical Promotion:** `auto_promote_rules(min_unique_runs=3)` promotes qualified rules to active.
