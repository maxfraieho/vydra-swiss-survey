# Декомпозиція завдань інтеграції Synapse

> **Специфікація:** `specs/002-synapse-integration`  
> **Статус:** Очікує підтвердження для переходу до Фази 2

---

## 📋 Перелік тасок розгортання та інтеграції

| ID | Задача | Змінювані файли | Критерії приймання (AC) | Ризик |
| :--- | :--- | :--- | :--- | :--- |
| **T-201** | Збірка Synapse та конфігурація сервісу у Termux | `~/synapse`, `~/synapse/apps/mcp-server/.env` | [ ] `pnpm build` успішно виконано в `~/synapse`, сервіс запускається у CLI/Stdio режимі | 🟢 Низький |
| **T-202** | Створення асинхронного адаптера `synapse_adapter.py` | `synapse_adapter.py` | [ ] Створено `synapse_adapter.py` з таймаутом <= 500мс, non-blocking ThreadPoolExecutor | 🟢 Низький |
| **T-203** | Інтеграція хуків у `persona_graph_memory.py` | `persona_graph_memory.py` | [ ] Додано асинхронні хуки у `record_fact()`, `record_host_rule()`, `record_run_trace()` | 🟡 Середній |
| **T-204** | Верифікація роботи адаптера та тест зворотної сумісності | `scripts/test_synapse_adapter.py` | [ ] Скрипт перевіряє нульовий вплив збоїв Synapse на роботу SQLite WAL | 🟢 Низький |

---

## 🛑 СТОП-КРИТЕРІЙ ФАЗИ 1

Артефакти специфікації та плану створено:
1. `specs/002-synapse-integration/spec.md`
2. `specs/002-synapse-integration/plan.md`
3. `specs/002-synapse-integration/tasks.md`

**Виконання Фази 2 призупинено до отримання підтвердження від користувача.**
