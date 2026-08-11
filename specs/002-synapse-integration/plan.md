# План інтеграції Synapse у `vydra-swiss-survey`

> **Специфікація:** `specs/002-synapse-integration`  
> **Статус:** Драфт (Фаза 1 - Очікує підтвердження)  
> **Джерело правди:** `docs/synapse-integration-plan.md`

---

## 1. Етапи розгортання та інтеграції

### Етап 1: Локальний сервіс Synapse (Termux)
1. Репозиторій склоновано в `~/synapse`.
2. Встановлено `pnpm` (v11.21.0), перевірено версію `@modelcontextprotocol/sdk` (v1.12.0).
3. Збірка монорепо `pnpm build` у `~/synapse`.
4. Створення конфігурації `.env` у `~/synapse/apps/mcp-server/.env` з підключенням до `SYNAPSE_EMBED_PROVIDER=local` або fast-hash embeddings.

### Етап 2: Розробка адаптера `synapse_adapter.py`
1. Створення файлу `synapse_adapter.py` у кореню `vydra-swiss-survey`.
2. Реалізація класів `SynapseAdapter` з використанням non-blocking `ThreadPoolExecutor`.
3. Захист таймаутами 500мс для кожного виклику.

### Етап 3: Хуки в `persona_graph_memory.py`
1. Інтеграція викликів у `record_fact()`, `record_host_rule()`, `record_run_trace()`.
2. Негайне повернення контролю в основний потік (fire-and-forget z логуванням помилок).

### Етап 4: Тестування та Верифікація
1. Запуск тестового скрипта `scripts/test_synapse_adapter.py`.
2. Верифікація зворотної сумісності SQLite WAL.
