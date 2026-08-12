# Feature Specification: 016-telegram-task-fetch-bugfix

> **Feature:** `016-telegram-task-fetch-bugfix`  
> **Status:** Active / In Implementation  
> **Target Deliverables:**  
> - Robust Telegram update payload parsing (captions, entities, text_link, trailing punctuation cleanup)  
> - Pass `override_url` from `extract_text_and_url_from_payload()` directly into `push_task_from_text()` in `telegram_listener_thread()`  
> - Automatic task creation for provider URLs (e.g. `sb.ktrmr.com`, `meinungsplatz.ch`, `qualtrics.com`, `forsta.com`)  

---

## 🎯 1. Overview & Purpose

Feature `016-telegram-task-fetch-bugfix` resolves the issue where Telegram bot updates containing captions, formatted text links, or raw survey URLs failed to create tasks in `astryx_survey_server.py`.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Caption & Text Link Extraction
As a tutor or operator, when I post a photo with a caption or a message with a text link to Telegram, the server MUST extract the text and URL and automatically add a task to the queue.

#### Given / When / Then:
- **Given** a Telegram update containing `caption` or `text_link` entities,
- **When** `telegram_listener_thread()` or `fetch_telegram_api()` processes the update,
- **Then** text and target URL are extracted without trailing punctuation and passed to `push_task_from_text()`.

---

## 🛡️ 3. Verification Requirements

1. **Integration Test:** `tests/integration/test_telegram_task_fetch_bugfix.py` MUST test caption extraction, text_link entity parsing, and task creation for `sb.ktrmr.com` URLs.
2. **Build & SDD Verification:** `bin/build_web.sh` and `bin/sdd_verify.sh` MUST complete cleanly.
