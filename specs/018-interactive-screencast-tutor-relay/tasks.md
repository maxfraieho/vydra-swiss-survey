# Tasks: 018 — Interactive Screencast & Desktop Tutor Relay

- [ ] **T-101**: Write integration test in `tests/integration/test_interactive_screencast_relay.py` verifying `/api/survey/relay_action` endpoint contract, coordinate normalization, and tutor memory recording.
- [ ] **T-102**: Implement `/api/survey/relay_action` in `astryx_survey_server.py` supporting `click`, `type`, `keypress`, `scroll`, and DOM element introspection.
- [ ] **T-103**: Enhance `CDPClient` in `cdp_client.py` with `dispatch_key(key)` and `scroll(dx, dy)` helper methods.
- [ ] **T-104**: Upgrade `SurveyOps.tsx` with full-width desktop view toggle, interactive click-to-CDP relay, coordinate scaling, visual ripple effects, and quick-action keyboard bar.
- [ ] **T-105**: Rebuild frontend bundle via `bash bin/build-deploy.sh` and verify all tests pass with `python3 -m pytest tests/`.
