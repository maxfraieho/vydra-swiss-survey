# Конституція проєкту `vydra-swiss-survey` (Project Constitution)

> **Версія:** 1.0.0  
> **Статус:** Дійсний інваріант розробки  
> **Методологія:** Spec-Driven Development (SDD) via GitHub Spec Kit (`specify-cli` v0.16.2)

---

## 1. Технологічний стек та інфраструктура

1. **Бекенд та API:** Python 3.14+ / Flask 3.x (`astryx_survey_server.py`, `rules_api.py`).
2. **Браузерне керування (CDP):** Direct Chrome DevTools Protocol (`cdp_client.py`) через WebSocket (`ws://127.0.0.1:9226/devtools/browser/...`).
3. **Персистентна пам'ять та Граф:** SQLite 3 (`~/.vydra-survey-profiles/survey_graph.db`).
   - **ОБОВ'ЯЗКОВИЙ РЕЖИМ:** Усі з'єднання МУСЯТЬ встановлювати `PRAGMA journal_mode=WAL` та `PRAGMA busy_timeout=5000`.
4. **Фронтенд та UI:** React 19 + TypeScript + Vite 5 + Дизайн-система Astryx (`@astryxdesign/core` v0.1.1, `@astryxdesign/cli`).
5. **AI-моделі та Комп'ютерний Зір:**
   - Multimodal Vision: Gemma 3 4B Vision (`vision.py` / Aegis proxy).
   - Local LLM Classification: Qwen 2.5 3B Instruct (`TRIAGE_LLM_BASE_URL` via Ollama).
6. **Аналіз архітектури та коду:** GitNexus Code Intelligence (`http://192.168.3.184:4747`).

---

## 2. Фундаментальні інваріанти розробки та безпеки

### 🔒 Інваріант 1: Політика PII та конфіденційності
- Жодні персональні дані (ПІІ), промпти персон (`.txt`) або облікові дані сайтів (`credentials.json`) **НЕ МОЖУТЬ бути закомічені у Git-репозиторій**.
- Усі конфіденційні файли зберігаються виключно в `~/.vydra-survey-profiles/` на розробницькому або продакшен-сервері та синхронізуються через `bin/sync_profiles.sh`.

### 🧠 Інваріант 2: Джерело правди та детермінізм
- Джерелом правди для скрінінгових правил та відповідей агента МУСИТЬ бути локальна SQLite граф-пам'ять (`persona_graph_memory.py`).
- Агент `survey_agent.py` спочатку шукає активні правила (`status='active'`), і лише за їх відсутності запитує AI-модель.

### 🛡️ Інваріант 3: Контроль ліфтингу та промоції правил
- Автоматична промоція теневих правил у статус `active` здійснюється **ВИКЛЮЧНО** функцією `auto_promote_rules()`.
- Вимога промоції: підтвердження у **N ≥ 3 незалежних completed прогонах** (`rule_applications`), де `wins > (losses * 2)`.
- Будь-який прямолінійний обхід 1-win промоції у `bump_rule_outcome()` суворо заборонений.

### ⚠️ Інваріант 4: Санітаризація позиційних евристик
- Селектори типу `item30`, `every-3rd`, `nth-child` вважаються крихкими (fragile).
- Будь-який ручний оверрайд із позиційною евристикою вимагає прапорця `confirm_positional: true`, повертаючи HTTP 422 при його відсутності, та записується з тегом `fragile: positional`.

### 🎨 Інваріант 5: Дизайн-конвенції Astryx UI
- Фронтенд-компоненти МУСЯТЬ дотримуватися принципів Astryx: *Prop independence*, *WCAG AA contrast*, 4px сітка відступів (`--spacing-4`).
- Каскадний порядок стилів регулюється `@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;`.

---

## 3. Правила SDD Workflow (`specify-cli`)

Усі нові фічі, рефакторинг або зміни API описуються за специфікаційним циклом:

1. `/speckit.specify`: Створення специфікації у `specs/<feature-name>/spec.md`.
2. `/speckit.plan`: Розробка архітектурного плану з обов'язковим аналізом впливу через GitNexus (`impact({target: symbol, direction: "upstream"})`).
3. `/speckit.tasks`: Декомпозиція на атомарні задачі з критеріями приймання (AC).
4. `/speckit.implement`: Послідовне виконання з викликом `detect_changes()` після кожного кроку.
