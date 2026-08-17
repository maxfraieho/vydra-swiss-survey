# Конституція проєкту `vydra-swiss-survey` (Project Constitution)

> **Версія:** 1.0.1  
> **Статус:** Дійсний інваріант розробки  
> **Методологія:** Spec-Driven Development (SDD) via GitHub Spec Kit (`specify-cli` v0.16.2)

---

## 1. Технологічний стек та інфраструктура

1. **Бекенд та API:** Python 3.14+ / Flask 3.x ([`astryx_survey_server.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py), [`rules_api.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/rules_api.py)).
2. **Браузерне керування (CDP):** Direct Chrome DevTools Protocol ([`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py)) через WebSocket (`ws://127.0.0.1:9226/devtools/browser/...`).
3. **Персистентна пам'ять та Граф:** SQLite 3 (`~/.vydra-survey-profiles/survey_graph.db`).
   - **ОБОВ'ЯЗКОВИЙ РЕЖИМ:** Усі з'єднання МУСЯТЬ встановлювати `PRAGMA journal_mode=WAL` та `PRAGMA busy_timeout=5000` ([`persona_graph_memory.py:L220-L222`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L220-L222)).
4. **Фронтенд та UI:** React 19 + TypeScript + Vite 5 + Дизайн-система Astryx (`@astryxdesign/core` v0.1.1, `@astryxdesign/cli`).
5. **AI-моделі та Комп'ютерний Зір:**
   - Multimodal Vision: Gemma 3 4B Vision ([`vision.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/vision.py) / Aegis proxy).
   - Local LLM Classification: Qwen 2.5 3B Instruct (`TRIAGE_LLM_BASE_URL` via Ollama).
6. **Аналіз архітектури та коду:** GitNexus Code Intelligence (`http://192.168.3.184:4747`).

---

## 2. Фундаментальні інваріанти розробки та безпеки

### 🔒 Інваріант 1: Політика PII та конфіденційності
- Жодні персональні дані (ПІІ), промпти персон (`.txt`) або облікові дані сайтів (`credentials.json`) **НЕ МОЖУТЬ бути закомічені у Git-репозиторій** ([`.gitignore:L5-L20`](file:///data/data/com.termux/files/home/vydra-swiss-survey/.gitignore#L5-L20)).
- Усі конфіденційні файли зберігаються виключно в `~/.vydra-survey-profiles/` на розробницькому або продакшен-сервері та синхронізуються через [`bin/sync_profiles.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/bin/sync_profiles.sh).

### 🧠 Інваріант 2: Джерело правди та детермінізм (Hot Path < 5ms)
- Джерелом правди для скрінінгових правил та відповідей агента МУСИТЬ бути локальна SQLite граф-пам'ять ([`persona_graph_memory.py:L480-L530`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L480-L530)).
- Агент [`survey_agent.py:L260-L300`](file:///data/data/com.termux/files/home/vydra-swiss-survey/survey_agent.py#L260-L300) спочатку оцінює 4-рівневий scope правил через `get_host_rules()`, виклики в гарячому шляху < 5мс через SQLite WAL.

### 👑 Інваріант 3: Пріоритет рішення оператора-людини (HITL Precedence)
- Корекції та оверрайди тутора-людини (`POST /api/survey/override_step`) мають **100% пріоритет** над висновками нейромережі Gemma Vision ([`astryx_survey_server.py:L150-L165`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py#L150-L165)).

### 🛡️ Інваріант 4: Контроль ліфтингу та промоції правил (N ≥ 3)
- Автоматична промоція теневих правил у статус `active` здійснюється **ВИКЛЮЧНО** функцією `auto_promote_rules(min_unique_runs=3)` ([`persona_graph_memory.py:L595-L625`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L595-L625)).
- Вимога промоції: підтвердження у **N ≥ 3 незалежних completed прогонах** (`rule_applications`), де `wins > (losses * 2)`.
- Результати фіксуються через `bump_rule_outcome()` ([`persona_graph_memory.py:L550-L590`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L550-L590)).

### 🚫 Інваріант 5: Заборона прямих пушів на dev-184
- Прямий push у гілку `master` на dev-184 суворо заборонений. Всі зміни надсилаються через SSH місток на `termux-sync` і перевіряються через build/test пайплайн ([`AGENTS.md:L45-L55`](file:///data/data/com.termux/files/home/vydra-swiss-survey/AGENTS.md#L45-L55)).

### ⚠️ Інваріант 6: Санітаризація позиційних евристик
- Селектори типу `item30`, `every-3rd`, `nth-child` вважаються крихкими (fragile).
- Будь-який ручний оверрайд із позиційною евристикою вимагає прапорця `confirm_positional: true`, повертаючи HTTP 422 при його відсутності, та записується з тегом `fragile: positional`.

---

## 3. Правила SDD Workflow (`specify-cli`)

Усі нові фічі, рефакторинг або зміни API описуються за специфікаційним циклом:

1. `/speckit.specify`: Створення специфікації у `specs/<feature-name>/spec.md`.
2. `/speckit.plan`: Розробка архітектурного плану з обов'язковим аналізом впливу через GitNexus (`impact({target: symbol, direction: "upstream"})`).
3. `/speckit.tasks`: Декомпозиція на атомарні задачі з критеріями приймання (AC).
4. `/speckit.implement`: Послідовне виконання з викликом `detect_changes()` після кожного кроку.

---

## 4. Журнал зафіксованих винятків

### Виняток #1 — прямий push у `master` з dev-184 (2026-08-17)

- **Що сталося:** Claude Code (оркестратор-сесія, працює через SSH на dev-184)
  виконав `git cherry-pick` + `git push` docs-коміту (`98573b0`, файл
  `docs/for-agents/prompts/research-multiagent-sdd-prompt.md`) напряму в
  `master`, в обхід SSH-містка `termux-sync` та build/test пайплайну,
  описаних в Інваріанті 5.
- **Чому це сталося:** Дію виконано за прямим запитом користувача
  ("push it", потім "лиши як є") ДО того, як конституцію було прочитано в
  цій сесії. Порушення виявлено постфактум під час планового читання
  `.specify/constitution.md`.
- **Чому залишено без відкату:** Зміна суто документаційна (один
  `.md`-файл, без коду, без впливу на runtime/API/схему БД). Користувач
  явно підтвердив залишити стан як є.
- **Статус Інваріанту 5:** Правило залишається чинним і не послаблюється
  цим записом. Це зафіксований одиничний виняток, не прецедент для
  майбутніх прямих пушів коду. Наступні зміни (особливо код, не docs)
  MUST йти через `termux-sync`.
