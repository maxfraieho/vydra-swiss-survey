# Tasks Breakdown: 008-fallback-browser-sources

- [x] **Task 1 (Spec & Plan):** Create `specs/008-fallback-browser-sources/spec.md` & `plan.md`.
- [ ] **Task 2 (Database Migration):** Add `priority` column to `browser_sources` and implement `get_active_browser_sources()`.
- [ ] **Task 3 (CDP Fallback & Multi-Tab Cleanup):** Implement sequential fallback loop and `opened_target_ids` cleanup in `cdp_client.py`.
- [ ] **Task 4 (API & UI Panel):** Add `/api/settings/browser-sources/<id>/reorder` endpoint and update `BrowserSourcesPanel.tsx`.
- [ ] **Task 5 (Unit & Integration Tests):** Write tests verifying fallback logic and multi-tab `close()` cleanup.
- [ ] **Task 6 (SDD Verification):** Update `bin/sdd_verify.sh` and run test suite.
