# SDD Specification: Feature 006 — Tutor Interactive Loop & High-Level Agent Integration

## 1. Context & Purpose
In Feature 005 (`005-tutor-live-activity`), we implemented the backend telemetry data structure `tutor_activity` and the React visual card **"🎓 Активність Тутора Навчання"** in `SurveyOps.tsx`.
This feature (006) expands that capability to high-level AI agents (AntiGravity, Claude, Agy) and the survey execution skill. It enables any autonomous agent taking a survey to continuously update the live Tutor Activity state and allow human operators (HITL) to view live decisions, confirm shadow rules, or override actions directly through the web interface.

## 2. Requirements & User Stories
- **User Story 1 (Agent Integration):** As a high-level agent (AntiGravity / Claude) executing a survey pass, I publish every pattern match, decision source (`Human Override`, `Shadow Rule`, `Active Rule`, `Vision Model`), and promotion count to the telemetry endpoint so the UI reflects my exact thought process.
- **User Story 2 (Human Interaction):** As a human tutor watching the live survey run, I can see the **"🎓 Активність Тутора Навчання"** card updating in real-time, inspect the proposed action, and click "Підтвердити правило" or "Змінити дію" to teach the agent on the fly.
- **User Story 3 (Skill Formalization):** As a developer, I have a standardized skill (`speckit-teaching`) that instructs high-level agents how to interact with the Tutor API during survey automation.

## 3. Data Schema Specifications
`tutor_activity` payload structure:
```json
{
  "active": true,
  "mode": "teaching",
  "decision_source": "Shadow Rule" | "Active Rule" | "Human Override" | "Vision Model" | "Tutor Ready",
  "matched_pattern": "String description of detected element",
  "chosen_behavior": "String action executed",
  "promotion_count": 2,
  "promotion_target": 3,
  "last_updated": 1786438000
}
```

## 4. API Endpoints
- `GET /api/survey/status` — Returns `tutor_activity` inside state object.
- `POST /api/survey/override_step` — Submits human override or confirmation, updating `tutor_activity` telemetry.

## 5. Acceptance Criteria
1. Any high-level agent (AntiGravity, Claude) following `speckit-teaching` updates `tutor_activity` state via API.
2. The UI card **"🎓 Активність Тутора Навчання"** renders decision source badges, matched patterns, chosen behaviors, and promotion progress ($N / 3$).
3. Human interactive controls on the UI card send POST requests to `/api/survey/override_step` and refresh telemetry without page reloads.
4. Unit/Integration tests verify end-to-end telemetry serialization and UI card contract.
