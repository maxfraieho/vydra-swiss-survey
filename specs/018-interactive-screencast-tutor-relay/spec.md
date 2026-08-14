# Feature Specification: 018 — Interactive Screencast & Desktop Tutor Relay

## 1. Overview & Business Value
This specification defines the interactive real-time browser relay and full-screen desktop viewer for `vydra-swiss-survey`. Instead of passive static screenshot observation, the human operator in Training Mode interacts directly with the survey in a large, desktop-proportioned view. Clicks, form inputs, and keypresses are relayed in real time to the live browser via CDP (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`), and human interactions are captured as structured training rules in `persona_graph_memory`.

## 2. Invariants & Non-Functional Requirements
1. **Hot Path Zero-Overhead:** Main execution loop latency must remain unaffected. Interactive relay requests execute on dedicated endpoints (`/api/survey/relay_action`) with < 100ms processing.
2. **Coordinate Precision:** Viewport scaling must accurately map click coordinates `(clientX, clientY)` on the rendered image element to the underlying browser viewport `(x, y)` using exact natural dimensions.
3. **Spec-Driven Tutor Recording:** When in training mode, every human interaction (`click`, `type`) generates a candidate rule (`status='shadow'`) in SQLite graph memory with contextual DOM element attributes.
4. **Full-Width Desktop View:** The browser viewport in Astryx UI must support full-width desktop aspect ratio (1280x800+ resolution) to allow comfortable human interaction, form filling, and captcha solving.

## 3. Scenarios (Given - When - Then)

### Scenario 1: Interactive Click Relay & Live Feedback
- **Given:** A survey is active on the browser (local, dev-184, or laptop Comet).
- **When:** The operator clicks at position `(x=450, y=280)` on the interactive desktop viewer in the Astryx UI.
- **Then:** The frontend dispatches `POST /api/survey/relay_action` with `{ action: 'click', x: 450, y: 280 }`.
- **And:** The backend dispatches `human_click(450, 280)` to the CDP session, captures the updated screenshot, and returns `{ status: 'success' }`.

### Scenario 2: Form Text & Keyboard Relay
- **Given:** An input field is active on the page (e.g. captcha field or text response).
- **When:** The operator enters text "81313" and clicks "Ввести текст" or presses Enter.
- **Then:** The backend receives `{ action: 'type', text: '81313' }` and types it into the active element via CDP.
- **And:** If in training mode, a host rule is recorded in `persona_graph_memory`.

### Scenario 3: Captcha Direct Resolution
- **Given:** An Altcha or interactive captcha challenge is displayed on screen.
- **When:** The operator directly clicks the Altcha checkbox and types the solution in the interactive viewer.
- **Then:** The browser executes the human-like click and verification without triggering bot detection heuristics.
