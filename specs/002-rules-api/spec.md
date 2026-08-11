# Специфікація модуля Rules REST API (`specs/002-rules-api`)

> **Специфікація:** `specs/002-rules-api`  
> **Статус:** Активна специфікація  
> **Базовий файл:** `rules_api.py`, `rules_report.py`

---

## 1. Функціональні вимоги

### 1.1 Маршрут `GET /api/rules`
- Повертає список правил `host_rules` із підтримуваними фільтрами: `host`, `persona`, `status`, `source`, `q`, `sort`, `order`, `limit`, `offset`.
- **ОБОВ'ЯЗКОВЕ ПОЛЕ:** Для кожного правила додається поле `confirmed_runs`, яке розраховується як:
  `SELECT COUNT(DISTINCT run_id) FROM rule_applications WHERE rule_id = ? AND LOWER(outcome) = 'completed'`.
- Оцінка ефективності правила повертає прапорці `effective: boolean` та `shadowed_by: number | null`.

### 1.2 Маршрут `GET /api/rules/facets`
- Повертає згруповані лічильники правил за хостами, персонами та джерелами.

### 1.3 Маршрути `GET /api/rules/async_queue` та `POST /api/rules/async_queue/<id>/resolve`
- Обслуговує чергу асинхронного розбору `async_review_queue` із підтримкою фільтрації за `status` та `triage_category`.

---

## 2. Інваріанти безпеки та SQLite
- Усі SQL-запити МУСЯТЬ бути повністю параметризованими (`?`).
- Жодні ін'єкції f-strings у тексту SQL не допускаються.
- З'єднання виконуються з `PRAGMA journal_mode=WAL` та `PRAGMA busy_timeout=5000`.
