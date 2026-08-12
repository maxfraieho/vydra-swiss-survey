# Technical Plan: 016-telegram-task-fetch-bugfix

> **Feature:** `016-telegram-task-fetch-bugfix`  

---

## 🏗️ 1. Architecture Strategy

1. **`astryx_survey_server.py`**:
   - Refactor `extract_text_and_url_from_payload()` to check `caption`, `caption_entities`, `entities`, `text_link`, and strip trailing punctuation (e.g. `)`, `.`, `,`, `]`, `"`) from extracted URLs.
   - Update `telegram_listener_thread()` to use `extract_text_and_url_from_payload(update)` and call `push_task_from_text(text, force=True, override_url=extracted_url)`.
