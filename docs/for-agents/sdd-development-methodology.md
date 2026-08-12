# Регламент та шаблони промптів SDD розробки для `vydra-swiss-survey`

> **Документ:** `docs/sdd-development-methodology.md`  
> **Методологія:** Spec-Driven Development (SDD) + GitNexus Code Intelligence  
> **Призначення:** Стандарт взаємодії з автономним кодинг-агентом (Agy / Flash 3.6 / Claude) для розробки нових фіч, виправлення багів та інтеграцій.

---

## 🏛️ 1. Ключові Інваріанти SDD Методології Проєкту

1. **Специфікація як Єдине Джерело Правди (Spec-First):** Будь-яка зміна починається з файлу `specs/<feature>/spec.md`. Код реалізує специфікацію; тести перевіряють наслідки поведінки.
2. **Код -> Специфікація (Ніколи з пам'яті):** Перед написанням специфікації чи тесту агент ОБОПОВ'ЯЗКОВО відкриває вихідні файли, перевіряє точні сигнатури та типи. Жодних вигаданих функцій!
3. **Захист гарячого шляху (Hot Path Invariant):** Головний цикл `survey_agent.py`, `get_host_rules()` та `bump_rule_outcome()` залишаються **100% легкими та синхронними** (< 5мс). Жодної генерації файлів, запусків pytest чи важких мережевих запитів під час виконання опитування.
4. **Нетавтологічне тестування (Behavioral Tests Only):** Заборонено тести `assert len(x) > 0` або `assert x == x`. Кожен тест описує реальний сценарій Given-When-Then, який може впасти при порушенні контракту.
5. **Емпірична верифікація:** Метрики продуктивності та зона ураження обчислюються реальними вимірами (GitNexus impact analysis, заміри латентності), а не вигаданими формулами.

---

## 🔄 2. Життєвий Цикл Задачі (4 Фази)

```text
[Фаза 1: Специфікація]  -->  [Фаза 2: Аналіз коду]  -->  [Фаза 3: Red/Green Тест]  -->  [Фаза 4: Реалізація]
(specs/<name>/spec.md)       (GitNexus impact check)     (Failing test -> Fix)        (pytest verification)
```

---

## 📋 3. Шаблони Промптів для Різних Типів Задач

---

### 🎨 ШАБЛОН 1: Нова Фіча (Feature Development)

```text
Ти — автономний кодинг-агент Agy. Завдання: розробити нову фічу [<НАЗВА_ФІЧІ>] за методикою Spec-Driven Development (SDD).

📍 КОНТЕКСТ ТА ІНВАРІАНТИ:
1. Ознайомся зі скілами `.agents/skills/sdd-workflow` та `.agents/skills/gitnexus-audit`.
2. Гарячий шлях (survey_agent.py, get_host_rules, bump_rule_outcome) МУСИТЬ залишатися легким і синхронним (< 5мс).
3. Спочатку прочитай реальні файли коду, не вигадуй сигнатури з пам'яті.

📍 КРОК 1 — SDD СПЕЦИФІКАЦІЯ:
- Створи директорію `specs/00X-<назва_фічі>/`.
- Оформи `specs/00X-<назва_фічі>/spec.md` зі сценаріями Given-When-Then, інваріантами та межами застосування.
- Оформи `specs/00X-<назва_фічі>/tasks.md` з чіткими тасками T-101, T-102...

📍 КРОК 2 — ГІТНЕКСУС АНАЛІЗ ВПЛИВУ:
- Прожини `python3 scripts/check_gitnexus_impact.py <symbol>` для функцій, які будуть модифіковані.

📍 КРОК 3 — РЕАЛІЗАЦІЯ ТА ТЕСТУВАННЯ:
- Напиши юніт/інтеграційні тести в `tests/unit/` або `tests/integration/`, які перевіряють наслідки поведінки нової фічі.
- Реалізуй код фічі.
- Прожени `python3 -m pytest tests/` і підтверди 100% проходження.
```

---

### 🐛 ШАБЛОН 2: Виправлення Багу / Проблема (Bug Fix / Incident)

```text
Ти — інженер з відлагодження Agy. Завдання: локалізувати та виправити інцидент/баг: [<ОПИС_ПРОБЛЕМИ_АБО_ПОМИЛКИ_З_ЛОГУ>].

📍 СУВОРІ ПРАВИЛА ВІДЛАГОДЖЕННЯ (docs/for-agents/debugging-playbook.md):
1. Спочатку знайди першопричину в коді, цитуй точний `файл:рядок` і сигнатуру.
2. Жодних вигаданих маскувань через порожні `try/except: pass` чи повернення dummy-значень.

📍 КРОК 1 — MINIMAL REPRODUCTION & FAILING TEST:
- Створи тест у `tests/regression/test_<issue_name>.py`, який моделює баг.
- Прожени `python3 -m pytest tests/` — тест МУСИТЬ впасти (RED State) ДО внесення правок у кодову базу.

📍 КРОК 2 — ФІКС ТА ПЕРЕВІРКА ВПЛИВУ:
- Перевір зону ураження зміненого символу через `python3 scripts/check_gitnexus_impact.py <symbol>`.
- Внеси точкову правку у кодову базу.
- Переконайся, що регресійний тест стає GREEN, а решта 9+ тестів продовжують проходити.
```

---

### ⚡ ШАБЛОН 3: Оптимізація / Рефакторинг (Refactoring & Performance)

```text
Ти — інженер з продуктивності Agy. Завдання: виконати рефакторинг / оптимізацію модуля [<НАЗВА_МОДУЛЯ_АБО_ФУНКЦІЇ>].

📍 ІНВАРІАНТИ ОПТИМІЗАЦІЇ:
1. Заборонено змінювати публічні контракти функцій (signatures), якщо вони мають викликачів у суміжних модулях.
2. Неблокуючий нефункціональний код (адаптери, метрики) виноситься в асинхронні ThreadPoolExecutor воркери з жорсткими таймаутами.

📍 КРОК 1 — ЕМПІРИЧНІ ЗАМІРИ ДО (BENCHMARK BEFORE):
- Заміряй поточний розподіл часу виконання (min / median / p95 / max) на 20 послідовних викликах.

📍 КРОК 2 — РЕФАКТОРИНГ ТА ЗОНА ВПЛИВУ:
- Перевір усіх викликачів через GitNexus impact analysis.
- Внеси оптимізацію.

📍 КРОК 3 — ЕМПІРИЧНІ ЗАМІРИ ПІСЛЯ (BENCHMARK AFTER):
- Покажи порівняльну таблицю латентності ДО та ПІСЛЯ.
- Прожени `python3 -m pytest tests/` для гарантії відсутності регресії.
```

---

### 🔌 ШАБЛОН 4: Інтеграція Зовнішнього Сервісу / API (Integration / Adapter)

```text
Ти — системний інженер Agy. Завдання: інтегрувати зовнішній сервіс [<НАЗВА_СЕРВІСУ_ТА_ПРОТОКОЛ>] з репозиторієм `vydra-swiss-survey`.

📍 АРХІТЕКТУРНІ ВИМОГИ:
1. Повна ізоляція: Зовнішній сервіс МУСИТЬ працювати поза гарячим шляхом (асинхронно через ThreadPoolExecutor).
2. Жорсткий таймаут: Встанови таймаут на основі реальних вимірів p95 (наприклад, 150мс для HTTP API, 1000мс для subprocess).
3. Fault-Tolerance: У разі відсутності сервісу (Connection refused / Timeout) помилка відсікається за < 2мс, ікріментується `app_settings.failures`, а основний цикл опитування продовжує працювати без затримок.

📍 КРОК 1 — ПЕРЕВІРКА ПРОТОКОЛУ СЕРВІСУ:
- Прочитай реальний контракт (Swagger/OpenAPI, JSON-RPC або Hono REST API).

📍 КРОК 2 — НАПИСАННЯ АДАПТЕРА:
- Реалізуй адаптер у окремому модулі (наприклад, `<service>_adapter.py`).
- Додай вимірювання та запис метрик у `app_settings`.

📍 КРОК 3 — ROUND-TRIP ВЕРИФІКАЦІЯ ТА РЕГРЕСІЙНИЙ ТЕСТ:
- Створи скрипт `scripts/verify_<service>_roundtrip.py` (запис -> зчитання назад -> перевірка співпадання).
- Створи `tests/regression/test_<service>_protocol.py` і підтверди проходження через `pytest`.
```

---

### 🎓 ШАБЛОН 5: Навчання Агента та Формалізація Правил (HITL Agent Teaching)

```text
Ти — інженер з навчання та аналізу поведінки Agy. Завдання: опрацювати результати навчання агента (Human-in-the-Loop) для профілю [<ПРОФІЛЬ: arno / annet>] на хості [<HOST>].

📍 ІНВАРІАНТИ НАВЧАННЯ (speckit-teaching):
1. Вибір оператора має 100% пріоритет над передбаченнями нейромережі.
2. Нові правила спочатку записуються в статусі `shadow` через `record_host_rule(..., status='shadow')`.
3. Промоція в `active` відбувається виключно після N >= 3 підтверджених прогонів з унікальними `run_id` через `auto_promote_rules(min_unique_runs=3)`.
4. Виклики `get_host_rules()` під час живого опитування залишаються неблокуючими (< 5мс).

📍 КРОК 1 — АНАЛІЗ РУЧНОЇ КОРЕКЦІЇ ТА СИГНАЛУ:
- Прочитай останній лог кроку з `Astryx UI` чи `ACTIVE_SURVEY_STATE`.
- Визнач патерн питання (наприклад, `tobacco`, `household`, `industry_exclusion`).

📍 КРОК 2 — ЗАПИС SHADOW-ПРАВИЛА ТА ЗВ'ЯЗКІВ:
- Додай shadow-правило в `persona_graph_memory.py` через `record_host_rule()`.
- Створи юніт-тест у `tests/unit/test_rules_engine.py`, який перевіряє вибір цього правила у каскаді пріоритетів.

📍 КРОК 3 — ЕМПІРИЧНА ПЕРЕВІРКА ТА ПРОМОЦІЯ:
- Переконайся, що `pytest` проходить успішно.
- Перевір стан промоції через `auto_promote_rules()`.
```

---

### 🔬 ШАБЛОН 6: Глибоке Дослідження та Архітектурний Аналіз (Deep Architectural Research)

```text
Ти — дослідницький інженер Agy. Завдання: провести глибокий аналіз та сформувати самодостатній дослідницький промпт-артефакт для теми: [<ТЕМА_ТА_ОПИС_ДОСЛІДЖЕННЯ>].

📍 КРОК 1 — АНАЛІЗ ФАКТИЧНОГО СТАНУ ТА СХЕМ:
- Зчитай наявний код, схеми БД у `persona_graph_memory.py` та специфікації у `specs/`.
- Зафіксуй точні файл:рядок цитати, що стосуються теми дослідження.

📍 КРОК 2 — ФОРМУВАННЯ ДОСЛІДНИЦЬКОГО ПРОМПТУ (GEMINI RESEARCH ARTIFACT):
- Створи промпт-файл у `docs/for-agents/prompts/gemini-research-<slug>.md`.
- Структура промпту МУСИТЬ містити:
  1. Роль та контекст завдання.
  2. Вхідні дані та точні файл:рядок посилання на вихідний код.
  3. Суворі інваріанти (Hot Path < 5ms, WAL mode, PII policy).
  4. Чіткі запитання для аналізу (Trade-offs, продуктивність, зворотна сумісність).
  5. Очікувана форма відповіді (покроковий план реалізації чи рекомендації).

📍 КРОК 3 — ПРЕЗЕНТАЦІЯ ТА ВКАЗІВКИ ДЛЯ КОРИСТУВАЧА:
- Повідоми користувача про створення файлу `docs/for-agents/prompts/gemini-research-<slug>.md`.
- Надай чітку інструкцію, як запустити це дослідження через Gemini чи моделі глибокого міркування.
```

---

### 📂 КОНВЕНЦІЯ СТРУКТУРИ SPEC-ФАЙЛІВ (`specs/`)

В репозиторії `vydra-swiss-survey` застосовуються два стандартизованих формати специфікацій:
1. **Feature Specs (`specs/<NNN-назва>/spec.md`):** Багатофайловий формат для нових великих модулів та доменів (`spec.md`, `plan.md`, `tasks.md`).
2. **Phase Improvement Specs (`specs/P<N>-<назва>.md`):** Однофайловий легкий формат для фазових вдосконалень системи навчання агента (P1: NFD-діакритика, P2: Bounding Boxes у %, P3: 4-level scope & `structure_hash`, P4: Vision CoT, P5: Self-Healing & Telegram Push). Всі P-специфікації містять Given/When/Then критерії та таблицю ризиків.


---

## 🚀 4. Промпт для Claude Code: Розгортання SDD Скіла у Нових Репозиторіях

Використовуйте цей системний промпт для автоматичного розгортання SDD-скліа агентом Claude у будь-якому новому проєкті. 

Також збережено в окремому файлі: [`docs/prompts/claude-sdd-skill-deploy-prompt.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/docs/prompts/claude-sdd-skill-deploy-prompt.md).

```text
Ти — автономний кодинг-агент Claude. Твоє завдання — розгорнути та активувати скіл Spec-Driven Development (SDD Workflow Skill) у цьому репозиторії.

📍 КРОК 1 — СТВОРЕННЯ ДИРЕКТОРІЇ ТА ФАЙЛУ СКТЛА:
Створи файл `.agents/skills/sdd-workflow/SKILL.md` (або `.claude/skills/sdd-workflow/SKILL.md`) з наступним вмістом:

---
name: sdd-workflow
description: Spec-Driven Development (SDD) methodology guide for specify-cli, project constitution, and behavioral non-tautological testing.
---

# Spec-Driven Development (SDD) Workflow Skill

## Core SDD Principles
1. **Specification as Single Source of Truth:** Specifications in `specs/<feature>/spec.md` define WHAT the system should do. Code MUST implement the spec; tests MUST verify behavioral consequences of the spec.
2. **Code First, Spec Second (No Memory Hallucinations):** Always inspect actual code signatures, line numbers, and database schemas before writing specs or tests.
3. **Honest Behavioral Tests (No Tautologies):** Tests must have a real chance to fail. Avoid `assert len(x) > 0` or `assert x == x`. Verify actual side effects, priority cascades, and failure handlings.
4. **Hot-Path Preservation:** Main execution loops MUST stay lightweight, synchronous, and zero-overhead. Heavy tasks (specs, network calls, audits) run asynchronously outside live execution.
5. **Empirical Verification:** Use real tool measurements (impact analysis, latency benchmarks) rather than arbitrary uncalibrated formulas.

## SDD Artifact Lifecycle
1. `.specify/constitution.md` -> High-level project invariants.
2. `specs/<domain>/spec.md` -> Feature specification (User stories, scenarios, Given-When-Then, invariants).
3. `specs/<domain>/plan.md` -> Technical implementation strategy & risk analysis.
4. `specs/<domain>/tasks.md` -> Modular task breakdown (T-101, T-102...).
5. `tests/unit/`, `tests/integration/`, `tests/regression/` -> Executable test suite verifying the specification.

📍 КРОК 2 — СТВОРЕННЯ СТРУКТУРИ ДИРЕКТОРІЙ:
Створи наступні папки, якщо вони ще не існують:
- `.specify/`
- `specs/`
- `tests/unit/`
- `tests/integration/`
- `tests/regression/`

📍 КРОК 3 — ПЕРЕВІРКА ТА ЗВІТ:
Підтверди створення файлу скіла, перевір його валідність та виведи короткий звіт про готовність репозиторію до SDD-розробки.
```

---

## 📦 5. Каталог Спеціалізованих SDD Скілів у Проєкті

У директорії `.agents/skills/` (та засихронізовано в `.claude/skills/`) підключено наступні 7 open-source скілів розширення Spec Kit:

1. **`speckit-constitution`:** Формування та перевірка недоторканних інваріантів у `.specify/constitution.md`.
2. **`speckit-specify`:** Трансформація ідей у Given-When-Then специфікації (`specs/<feature>/spec.md`).
3. **`speckit-clarify`:** Брейнштормінг-інтерв'юер для знаходження «сліпих плям» та зняття неоднозначностей.
4. **`speckit-plan`:** Декомпозиція та планування тасок (`specs/<feature>/plan.md` & `tasks.md`).
5. **`speckit-assumptions`:** Скіл Адді Османі для явного опису блока `ASSUMPTIONS I'M MAKING` та межам 6 зон бізнес-контексту.
6. **`speckit-architecture-guard`:** Автоматичний перевіряючий безпеки (OWASP, SQL Injection) та захисту гарячого шляху під час планування.
7. **`speckit-canon`:** Відстеження дрейфу специфікацій (`spec-drift`) для існуючих вихідних файлів проєкту.


---

## 🛠️ 6. Розгортання /sdd:* Slash-Команд

Для автоматизації та зручного виклику 5 ключових шаблонів SDD-розробки у проєкті розгорнуто систему slash-команд у `.claude/commands/sdd/` з документаційним описом у [`docs/for-agents/prompts/README-sdd-commands.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/docs/for-agents/prompts/README-sdd-commands.md).

### 1. Для Claude Code (`.claude/commands/sdd/`)
Усі 5 команд розміщені в `.claude/commands/sdd/` і посилаються на Шаблони з `docs/for-agents/sdd-development-methodology.md`:
* **`/sdd:feature`** — Запускає Шаблон 1 ("🎨 Нова Фіча"): створює `specs/<NNN>-<slug>/spec.md`, виконує `check_gitnexus_impact.py`, створює RED->GREEN тести та реалізацію.
* **`/sdd:bugfix`** — Запускає Шаблон 2 ("🐛 Виправлення Бага"): ізоляція багу, тест відтворення RED, рефакторинг та GREEN підтвердження.
* **`/sdd:refactor`** — Запускає Шаблон 3 ("♻️ Безпечний Рефакторинг"): перевірка існуючого покриття, impact-аналіз залежностей через GitNexus, ізольовані зміни без регресії.
* **`/sdd:integration`** — Запускає Шаблон 4 ("🔌 Інтеграція Сервісів / Протоколів"): розробка адаптера, verification-скрипт `verify_<service>_roundtrip.py`, regression-тести.
* **`/sdd:teaching`** — Запускає Шаблон 5 ("🎓 Навчання Агента та Формалізація Правил"): аналіз HITL-корекцій, створення shadow-правила, N>=3 промоція.

### 2. Для Агента Agy (AntiGravity / `agy`)
Агент Agy виконує еквівалент slash-команд через:
* **Активацію Скіла:** `.agents/skills/sdd-workflow/SKILL.md` (чи `/speckit.*`).
* **Прямий виклик у промпті:** Сформулюйте запит із вказівкою номера Шаблону (наприклад, *"Виконай SDD Шаблон 1 з docs/sdd-development-methodology.md для фічі X"*). Agy зчитує відповідний Шаблон напряму з методики, гарантуючи 100% відсутність розбіжностей (spec-drift).

### 3. Для Інших Агентів (Qwen 2.5, Gemini)
* **Програмовані воркери (Qwen 2.5):** Запускаються автоматично через `persona_graph_memory.py` для auto-triage черги `async_review_queue`. Slash-команди не застосовуються.
* **Дослідницькі промпти (Gemini):** Викликаються через готові промпт-файли у `docs/prompts/gemini-*`. Взаємодія здійснюється через прямий текст промпту із посиланням на номер Шаблону.


