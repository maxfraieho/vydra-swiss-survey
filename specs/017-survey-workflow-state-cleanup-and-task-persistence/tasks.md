# Tasks: 017-survey-workflow-state-cleanup-and-task-persistence

- [x] **T-101**: Add `pending_tasks` table and CRUD functions in `persona_graph_memory.py`.
- [x] **T-102**: Update `astryx_survey_server.py` to persist pending tasks and provide `/api/survey/reset_state` & `clear_active_survey_state`.
- [x] **T-103**: Update `astryx_survey_server.py` cache-control headers on `serve_app` for `index.html`.
- [x] **T-104**: Create unit & integration tests (`test_pending_tasks_persistence.py`, `test_survey_state_cleanup.py`).
- [x] **T-105**: Update `SurveyOps.tsx` with dedicated manual entry form, state reset button, and idle view hiding stale survey leftovers.
- [x] **T-106**: Build frontend (`npm run build`), verify anti-caching & clean idle state, and pass all test suites.

