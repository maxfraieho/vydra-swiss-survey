# Tasks: Tutor Live Activity Card & Realtime Training Telemetry

**Feature Name:** `005-tutor-live-activity`  

---

- [x] **Task 1: Spec & Schema Formalization**
  - Create `specs/005-tutor-live-activity/spec.md` with requirements and JSON schemas.
  - Create `specs/005-tutor-live-activity/plan.md` with data flow diagrams.

- [x] **Task 2: Backend Telemetry Integration**
  - Add `tutor_activity` to `ACTIVE_SURVEY_STATE` in `astryx_survey_server.py`.
  - Add thread-safe helper `update_tutor_activity()`.
  - Wire `override_step_api` to trigger tutor activity updates upon human correction.

- [x] **Task 3: Integration Test Suite**
  - Create `tests/integration/test_tutor_activity_sdd.py` verifying status payload schema.

- [x] **Task 4: Frontend UI Component**
  - Define `TutorActivity` interface in `web/src/screens/ops/SurveyOps.tsx`.
  - Implement styled visual card with decision source badge and promotion progress bar.
  - Execute production build via Vite (`bin/build_web.sh`).

- [x] **Task 5: Deployment & Verification**
  - Execute `pytest` test suite (13/13 passing).
  - Deploy to dev-184 server and verify live API status response.
