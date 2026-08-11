# Специфікація модуля Інтеграції Synapse Memory OS (`specs/002-synapse-integration`)

> **Специфікація:** `specs/002-synapse-integration`  
> **Статус:** Драфт (Фаза 1 - Очікує підтвердження)  
> **Базовий файл:** `synapse_adapter.py`, `persona_graph_memory.py`

---

## 1. Функціональні вимоги та Архітектура

### 1.1 Асинхронний адаптер `synapse_adapter.py`
- Адаптер надає non-blocking асинхронні виклики для дзеркалювання фактів та сесійний trace у локальний сервер Synapse Memory OS (`~/synapse/apps/mcp-server`).
- **Таймаут виклику:** МАКСИМУМ **500 мс** на мережевий запит до Synapse. Якщо Synapse відповідає довше або офлайн, адаптер тихо логує та повертає керування без блокування `survey_agent.py` або `persona_graph_memory.py`.
- **Фоновий потік Execution Thread:** Синхронізація фактів здійснюється у фоновому потоці (`ThreadPoolExecutor(max_workers=2)`).

### 1.2 Відстеження метрик повторів (Retry Metrics)
- У разі збою Synapse (наприклад, сервер офлайн), лічильники помилок та затримок зберігаються в таблиці `app_settings` (ключі `synapse_sync_failures`, `synapse_last_sync_ts`).

### 1.3 Хуки в `persona_graph_memory.py`
- `record_fact(subject, predicate, object, ...)` -> хук `synapse_adapter.sync_fact_async()`
- `record_host_rule(host, pattern, behavior, ...)` -> хук `synapse_adapter.sync_rule_async()`
- `record_run_trace(run_id, host, persona, ...)` -> хук `synapse_adapter.sync_trace_async()`

---

## 2. Інваріанти безпеки та зворотної сумісності

- **Первинне джерело правди (Primary Source of Truth):** Локальна SQLite граф-пам'ять `persona_graph_memory.py` залишається 100% первинним і обов'язковим джерелом знань для агента. Synapse є вторинним семантичним шаром пам'яті.
- **Нічого не блокується:** Будь-який збій чи таймаут Synapse **НЕ ВПЛИВАЄ** на успішність виконання опитувань чи збереження даних у SQLite.
- **SQLite WAL Mode:** Усі операції з `app_settings` зберігають `PRAGMA journal_mode=WAL` та `PRAGMA busy_timeout=5000`.
