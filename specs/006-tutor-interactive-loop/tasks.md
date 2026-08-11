# Tasks Breakdown: Feature 006 — Tutor Interactive Loop & High-Level Agent Integration

- [x] **Task 1 (SDD Spec & Architecture):** Create `specs/006-tutor-interactive-loop/spec.md`, `plan.md`, `tasks.md`.
- [ ] **Task 2 (Teaching Skill Update):** Update `.agents/skills/speckit-teaching/SKILL.md` and `.claude/skills/speckit-teaching/SKILL.md` to instruct AntiGravity, Claude, and high-level agents how to publish `tutor_activity` telemetry.
- [ ] **Task 3 (Backend Telemetry Helper):** Verify `astryx_survey_server.py` helper `update_tutor_activity()` supports interactive override payloads.
- [ ] **Task 4 (Web UI Interactive Card):** Update `web/src/screens/ops/SurveyOps.tsx` to add interactive action buttons to **"🎓 Активність Тутора Навчання"**.
- [ ] **Task 5 (Vite Build & Local Deploy):** Execute `bash bin/build-deploy.sh` to compile Vite assets and reload server in memory.
- [ ] **Task 6 (Integration Test & Verification):** Write `tests/integration/test_tutor_interactive_loop.py` and run `python3 -m pytest tests/`.
- [ ] **Task 7 (SD Card Sync & Git Commit):** Sync to `/storage/emulated/0/Projects/vydra-swiss-survey` and commit.
