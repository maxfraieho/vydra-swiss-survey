# Implementation Plan: 018 — Interactive Screencast & Desktop Tutor Relay

## 1. Architectural Strategy
1. **Backend Relay API (`astryx_survey_server.py`)**:
   - Create `@app.route('/api/survey/relay_action', methods=['POST'])`.
   - Dispatch `click` (interpolated mouse move + down + up), `type` (text entry), `keypress` (Enter, Tab, Escape, etc.), and `scroll` via `CDPClient`.
   - Take immediate fresh screenshot and update `tutor_activity` telemetry.
2. **Frontend Desktop Interactive Canvas (`SurveyOps.tsx`)**:
   - Upgrade the live viewer section to a full-width desktop layout with natural coordinate calculation.
   - Add click ripple indicator, active target feedback, and interactive control bar (text input, Enter, Tab, Scroll ⬇️/⬆️).
   - Add "🖥️ Розгорнути на всю ширину (Desktop View)" toggle mode.
3. **Automated Tutor Rule Capture (`persona_graph_memory.py`)**:
   - Automatically extract element under cursor during relay actions and save shadow rule if training mode is on.
4. **Behavioral Test Suite (`tests/integration/test_interactive_screencast_relay.py`)**:
   - Verify `/api/survey/relay_action` responds cleanly with proper coordinate handling and mock CDP dispatch.
