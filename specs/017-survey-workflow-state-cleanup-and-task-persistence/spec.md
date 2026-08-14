# Feature Specification: 017-survey-workflow-state-cleanup-and-task-persistence

> **Feature:** `017-survey-workflow-state-cleanup-and-task-persistence`  
> **Status:** Active / In Implementation  
> **Target Deliverables:**  
> - SQLite persistence for pending tasks and telegram notifications in `persona_graph_memory.py` (`pending_tasks` table).  
> - Clean lifecycle state transitions in `astryx_survey_server.py`: complete removal of stale survey leftovers (old 404 page text, stale step decisions, countdown timers, stale screenshot files) when idle or completed.  
> - Dedicated Manual Survey Entry Form in Astryx Web UI (`SurveyOps.tsx`) with fast text/link parser for email invitations.  
> - Explicit State Reset API (`POST /api/survey/reset_state`) and UI action button ("🧹 Скинути стан").  
> - `Cache-Control: no-cache, no-store, must-revalidate` for `index.html` and static bundles to eliminate stale browser rendering.  
> - Fixed method signatures (`save_setting` alias to `set_setting`) preventing listener thread crashes.  

---

## 🎯 1. Overview & Business Value

Tutors and automated agents need a reliable workflow for surveys received via Telegram groups and email invitations:
1. When a survey notification arrives via Telegram or is manually inputted from email, the task MUST persist in SQLite and survive server restarts.
2. The UI console MUST NOT show stale leftovers (old 404 error texts, expired countdowns, previous survey screenshots) when no survey is running.
3. The UI MUST provide a clean, dedicated form to manually add email survey links or paste raw email text to auto-parse parameters.
4. UI changes must immediately reflect in the client browser without being suppressed by stale server processes or client browser caching.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### Scenario 1: Persistent Pending Tasks across Restarts
- **Given** a survey notification is parsed from Telegram or added manually,
- **When** `push_task_from_text()` or `/api/survey/trigger` executes,
- **Then** the task is stored in the `pending_tasks` SQLite table and immediately loaded on server reboot.

### Scenario 2: Complete Stale State Cleanup
- **Given** a previous survey completed, failed, or was stopped,
- **When** the server transitions to `idle` or `finished` (or when calling `POST /api/survey/reset_state`),
- **Then** `pending_step`, `pending_decision`, `pending_page_text`, `pending_pattern`, and stale `latest_survey_step.png` are completely cleared.
- **Then** `SurveyOps.tsx` displays the clean idle state rather than the old step/404 screenshot.

### Scenario 3: Dedicated Manual Entry & Email Link Parser Form
- **Given** a user receives an invitation email with a survey link,
- **When** the user pastes the URL (or full email text) into the "➕ Запуск опитування вручну / з пошти" form,
- **Then** the form extracts Persona, Reward, and Duration, and allows immediate execution or queueing, clearing the input fields upon submission.

### Scenario 4: Cache-Control & Deployment Freshness
- **Given** frontend changes are compiled to `web/dist`,
- **When** a user visits `/` or `/survey`,
- **Then** `index.html` is served with `no-cache, no-store, must-revalidate` headers so updated JavaScript bundles load immediately.

---

## 🛡️ 3. Verification & Invariants

1. **Unit Tests:** `tests/unit/test_pending_tasks_persistence.py` verifies SQLite CRUD for pending tasks.
2. **Integration Tests:** `tests/integration/test_survey_state_cleanup.py` verifies state clearing, reset endpoint, and Telegram listener error resilience.
3. **Frontend Build:** `npm run build` inside `web/` produces fresh bundles with zero TypeScript errors.
