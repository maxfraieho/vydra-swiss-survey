# Конституція проєкту `vydra-swiss-survey` (Project Constitution)

> **Версія:** 1.1.0  
> **Статус:** Дійсний інваріант розробки  
> **Методологія:** Spec-Driven Development (SDD) via GitHub Spec Kit (`specify-cli` v0.16.5, `specify integration install claude`+`codex` виконано 2026-08-17 — `specs/021-multiagent-sdd-extension/`)

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

> **Оновлено 2026-08-17** (`specs/021-multiagent-sdd-extension/`). Попередня редакція посилалась на команди `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` як на нормативний виконуваний контур. Живий SSH-аудит (2026-08-17, до install) показав: ці команди **не існували** в жодному агентному середовищі репо — `.specify/` містив лише сам файл конституції, без `templates/`/`scripts/`/`integration.json`. Після `specify integration install claude`+`codex` того ж дня стан змінився: `.specify/{templates,scripts,integrations}` тепер реальні, `.claude/skills/speckit-*` та `.agents/skills/speckit-*` — офіційні upstream Agent Skills (не текстові slash-команди з позиційною підстановкою).

**Правило пріоритету:** ця конституція визначає інваріанти; `docs/for-agents/sdd-development-methodology.md` — процедуру (9 project-шаблонів); native Spec Kit / Codex / AGY-механізми — лише транспорт виклику. За конфліктом між шарами виграє конституція.

| Фаза SDD | Native механізм (Spec Kit Agent Skill) | Project-команда (`.claude/commands/sdd/`) | Спільний скіл (AGY+Codex) |
|---|---|---|---|
| Specify | `speckit-specify` (auto/semantic invocation, Claude Code) | `/sdd:feature` | `.agents/skills/sdd-feature` |
| Clarify | `speckit-clarify` | `/sdd:clarify` | `.agents/skills/speckit-clarify` |
| Plan | `speckit-plan` | (у складі `/sdd:*` шаблонів) | `.agents/skills/speckit-plan` |
| Tasks | `speckit-tasks` | (у складі `/sdd:*` шаблонів) | `.agents/skills/speckit-tasks` |
| Implement | `speckit-implement` | `/sdd:{bugfix,refactor,integration,teaching}` | `.agents/skills/sdd-*` |
| Verify | — (project-only) | `/sdd:verify` | `bin/sdd_verify.sh` |

Важливо: native Spec Kit механізм — це **Agent Skills** (`name`+`description` frontmatter, семантична/model-invocation активація), НЕ буквальні slash-команди на кшталт `/speckit.specify`. Формулювання попередньої редакції ("`/speckit.specify`: Створення специфікації…") було неточним — виправлено вище.

Усі нові фічі, рефакторинг або зміни API описуються за специфікаційним циклом:

1. `/sdd:feature` (project) або семантична активація `speckit-specify` (native): Створення специфікації у `specs/<feature-name>/spec.md`.
2. Розробка архітектурного плану з обов'язковим аналізом впливу через GitNexus (`impact({target: symbol, direction: "upstream"})`).
3. Декомпозиція на атомарні задачі з критеріями приймання (AC).
4. Послідовне виконання з викликом `detect_changes()` після кожного кроку.
5. `bash bin/sdd_verify.sh` перед комітом.
