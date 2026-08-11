# Feature Specification: Tutor Live Activity Card & Realtime Training Telemetry

**Feature Name:** `005-tutor-live-activity`  
**Status:** Draft / Retroactively Formalized  
**Author:** Antigravity SDD Lead  
**Created:** 2026-08-11  

---

## 1. Executive Summary & Business Value
During human-in-the-loop (HITL) survey agent training, operators require real-time visibility into the agent's tutor logic, matched host rules, decision sources, and promotion progress ($N / 3$ runs). Without a dedicated telemetry UI, operators cannot verify whether human overrides are correctly converted into `shadow` rules or whether existing rules are being applied.

This specification defines the backend telemetry payload (`tutor_activity`) and frontend visual component (`Tutor Live Activity Card`) within the Astryx UI Console (`/ops`).

---

## 2. Core SDD Requirements & System Invariants

### User Story 1: Realtime Decision Source Display
- **Given** an active survey run in training mode (`training_mode = true`),
- **When** a step is evaluated or corrected by a human operator,
- **Then** the system MUST report `last_action_source` as one of:
  - `human_override` (🟢 Green Badge)
  - `shadow_rule` (🟡 Yellow Badge)
  - `active_rule` (🔵 Blue Badge)
  - `vision_model` (🟣 Purple Badge)
  - `idle` (⚪ Slate Badge)

### User Story 2: Matched Rule & Behavior Transparency
- **Given** a rule match or human override in `astryx_survey_server.py`,
- **When** `/api/survey/status` is polled by the UI,
- **Then** `tutor_activity.matched_rule` MUST contain `pattern`, `behavior`, `status`, and `confidence`.

### User Story 3: Empirical Promotion Progress Tracking ($N / 3$)
- **Given** a `shadow` host rule recorded during training,
- **When** `tutor_activity.promotion_info` is updated,
- **Then** the UI MUST render the current number of unique successful runs (`unique_runs`) against the target threshold (`target_runs = 3`).

---

## 3. Technical Contract & Schema Definitions

### JSON Schema: `tutor_activity` Payload
```json
{
  "last_action_source": "human_override | shadow_rule | active_rule | vision_model | idle",
  "tutor_explanation": "string",
  "matched_rule": {
    "pattern": "string",
    "behavior": "string",
    "status": "shadow | active",
    "confidence": 0.9,
    "host": "string"
  },
  "promotion_info": {
    "unique_runs": 1,
    "target_runs": 3
  },
  "updated_at": "HH:MM:SS"
}
```

---

## 4. Acceptance Criteria & Test Plan
1. **API Endpoint Test:** `GET /api/survey/status` returns valid `tutor_activity` dictionary even when state is initial (`idle`).
2. **Override Hook Test:** `POST /api/survey/override_step` populates `tutor_activity.last_action_source = "human_override"` and includes rule payload.
3. **Frontend Component Test:** React component renders decision badge and explanation when `training_mode = true`.
