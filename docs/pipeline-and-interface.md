# vydra-swiss-survey — pipeline та інтерфейс (детально)

> Статус на 2026-08-08. Живий документ — оновлювати секцію "Статус фаз" при кожному мерджі U3-U6, не чекати кінця міграції. Джерело істини — код; якщо цей файл розходиться з кодом, вір коду і виправ файл.

## 0. Що це за проєкт

Агент проходить швейцарські платні опитування (meinungsplatz.ch, Bilendi, GfK, mriweb...) від імені двох персон (Арно, Аннет), керуючи реальним браузером через Chrome DevTools Protocol. На кожному кроці робить скріншот → Gemma-3-4B vision вирішує ОДНУ дію (клік/ввід/скрол) → дія виконується → повтор. Людина може спостерігати й коригувати в реальному часі через Режим Навчання.

Два окремих UI:
- **`/legacy`** (стара Flask HTML-сторінка, `astryx_survey_server.py`) — керування живим опитуванням: старт, Режим Навчання (verify/approve/override), лог.
- **React SPA** (корінь домену `survey.exodus.pp.ua/`) — перегляд/аудит `host_rules` і трейсів. Наразі READ-ONLY (мутаційний API щойно з'явився, UI під нього ще не написаний — див. §4).

## 1. Наскрізний потік одного опитування

```
astryx_survey_server.py (Flask, завжди запущений процес)
  └─ POST /api/survey/trigger (з Telegram-боту або /legacy кнопки)
       └─ створює task_id, чекає авторизації (10 хв timeout)
       └─ запускає survey_agent.py --profile X --url Y як підпроцес
                │
                ▼
survey_agent.py (одноразовий підпроцес, живе рівно один прогін)
  1. heavy_state_busy() — перевірка, чи не зайнятий телефон важким
     процесом (llama-server / vision / конвертація книг) — щоб не OOM
  2. load_persona(profile, survey_url)
       └─ читає ~/.vydra-survey-profiles/<файл>.txt (базова легенда)
       └─ обрізає технічні інструкції ("## A — ДІЯ") — economy для Gemma
       └─ get_enhanced_persona() з persona_graph_memory.py домішує
          host_rules для цього host+persona (якщо VYDRA_PLAYBOOK != off)
  3. CDPClient підключається до Chrome через ensure_tunnel (SSH-тунель
     на віддалений vision-хост, порт з REMOTE_PORTS)
  4. try_login() — якщо є credentials.json запис для site_host
  5. головний цикл (по кроку за раз):
       page_text = client.page_text()          # cdp_client.py
       topic = reflection.detect_pattern(page_text)   # tobacco/health/...
       screenshot → GemmaVision.run() → одна дія {action, target, value}
       ── training_mode active? ──
       │   POST /api/survey/verify_step {step, decision, pattern, page_text}
       │   → Flask блокується на verification_event.wait(timeout=300)
       │   → людина в /legacy тисне Approve або Override
       │   → якщо Override з pattern: record_host_rule(source=human_override,
       │        status=active, confidence=0.9) — ОДРАЗУ активне правило
       │   → якщо Override без pattern: старий плаский record_fact() (rule_<ts>)
       └── дія виконується на реальній сторінці
  6. після циклу (break з max_steps, помилки, або Gemma сказала "done"):
       page_text() + get_current_url() ЩЕ ДО client.close()
       classify_outcome(final_text, final_url, gemma_said_done, dry_run, ...)
            → перевіряє DQ_PHRASES ПЕРЕД DONE_PHRASES (нім. "Vielen Dank"
              трапляється і на дискваліфікації) → outcome, reason
       record_run_trace(run_id, outcome, reason, final_text, steps)
       record_survey_outcome(profile, url, outcome, ...)
       bump_rule_outcome(rule_ids_used, outcome)   # wins/losses на кожне
            правило, що застосовувалось цього прогону
       якщо outcome погіршився (disqualified/incomplete/error):
            reflection.reflect(trace) → rule-based ліки, status=shadow,
            source=self_reflection — НІКОЛИ не перезаписує active
            human_override на той самий (host,persona,pattern)
       весь блок у try/except — рефлексія НІКОЛИ не міняє exit code
                │
                ▼
exit code → Flask бачить completed/failed → оновлює задачу в черзі,
            логує в /legacy, Telegram-повідомлення
```

## 2. Ключові модулі

### `survey_agent.py` (356 рядків)
Одноразовий CLI-скрипт (`python3 survey_agent.py --profile arno --url ...`), не сервер. `PROFILES` (рядок 30) — мапа `profile_key → {persona_file, label}`. `load_persona()` (63) — єдина точка збірки промпту персони. `heavy_state_busy()` (45) — навмисно НЕ імпортує з kindle-butch-gen (окремий репо, без cross-repo coupling за рішенням користувача), дублює pgrep-патерни.

### `cdp_client.py` (403 рядки)
`CDPClient` — тонка обгортка над Chrome DevTools Protocol websocket. `ensure_tunnel()` (48) — піднімає SSH-тунель до віддаленого хоста, де фактично сидить Chrome/vision (телефон сам важкий інференс не тягне). `page_text()` — JS `document.body.innerText`, try/except → `""`, ~5мс, викликається перед КОЖНИМ vision-кроком для `reflection.detect_pattern()`.

### `vision.py`
`GemmaVision` — клієнт до Gemma-3-4B (мультимодальна модель, приймає скріншот + текст промпту, повертає одну дію JSON). `GemmaVision.run_text()` (без картинки) зарезервований для `VYDRA_REFLECT_LLM=1` — LLM-рефлексія, зараз стаб.

### `reflection.py` (192 рядки) — класифікація результату й правило-базоване навчання
- `TOPIC_KEYWORDS` — патерн → мультимовні підрядки (de/fr/it/en): `tobacco`, `health_status`, `alcohol`, `auto`, `finance`, `income`, `employment`, `industry_exclusion`, `household`, `shopping`.
- `detect_pattern(page_text)` — перший збіг у перших ~600 символах; `None` якщо нема (ніколи не вигадує патерн).
- `QUALIFYING_POLARITY` — яка полярність відповіді кваліфікує кандидата (`affirm`/`deny`/`not_fully_healthy`). `industry_exclusion` завжди `deny` — стандартне правило скринінгу опитувань (ніколи не визнавати роботу в market research/реклами).
- `DQ_PHRASES` / `DONE_PHRASES` (+ URL-маркери), по мовах — DQ перевіряється ПЕРЕД DONE (нім. дискваліфікаційні сторінки теж містять "vielen Dank").
- `classify_outcome(final_text, final_url, *, gemma_said_done, dry_run, exception="", hit_max_steps=False) -> (outcome, reason)` — може перевизначити хибний `done` від Gemma на `disqualified`.
- `reflect(trace, *, use_llm=False, vision=None) -> list[lessons]` — лише при `outcome ∈ {disqualified, incomplete, error}`; бере останні ≤3 кроки, зіставляє відповідь із `NEGATIVE_TOKENS`/полярністю → будує `behavior`-текст, confidence 0.4-0.6. Пропускає патерн, якщо вже є `active` human_override правило на нього (людина завжди перемагає). `use_llm=True` — стаб, повертає `[]`.

### `persona_graph_memory.py` (678 рядків, до U3; +214 з U3, `369e018`, live з 2026-08-08) — вся SQLite-персистенція
БД: `~/.vydra-survey-profiles/survey_graph.db`.

**Таблиці:**
```sql
host_rules(id, host, persona, pattern, behavior, source, status, confidence,
           hits, wins, losses, evidence, created_at, updated_at)
  UNIQUE(host, persona, pattern, source)
  -- source: human_override | self_reflection | seed
  -- status: shadow | active | retired

run_traces(run_id PK, persona, host, url, started_at, ended_at,
           outcome, outcome_reason, final_text, steps_json)
  -- ~8KB/трейс, останні 40 на хост

rule_audit(id, rule_id, actor, action, before_json, after_json, note, created_at)
  -- U3: audit-лог кожної людської правки над host_rules
```

**Функції читання/запису (стабільні, до U3):**
- `norm_host(url_or_host)`, `base_domain(host)` — нормалізація хоста.
- `record_host_rule(host, pattern, behavior, *, persona="*", source, status="shadow", confidence=0.5, evidence=None)` — UPSERT по `(host,persona,pattern,source)`; при конфлікті — `confidence = min(0.95, old+0.15)`. Це шлях self_reflection і старого override-коду.
- `get_host_rules(host, persona, include_shadow=False)` — пріоритет: точний host > base_domain > `*`; human_override завжди над self_reflection.
- `bump_rule_outcome(rule_ids, outcome)` — wins/losses; auto-promote shadow→active лише при `VYDRA_PLAYBOOK=active`; auto-retire при `losses>=3 and losses>wins`.
- `get_enhanced_persona(profile_key, base_persona, survey_url="")` — єдина точка читання для промпту. Секції: §1 реальні факти (найвищий пріоритет) → §2 правила хоста (лише якщо `survey_url` задано і `VYDRA_PLAYBOOK != off`, макс 12 правил/1500 симв.) → §3 калібрування кваліфікації (лише `VYDRA_PLAYBOOK=active`). Гейт: `VYDRA_PLAYBOOK=off|shadow|active` (дефолт shadow), `VYDRA_PLAYBOOK_HOSTS=host1,host2`.
- CLI (`python3 persona_graph_memory.py <cmd>`): `record` / `facts` / `history` / `rules <host>` / `migrate` — єдиний зараз працюючий спосіб ручного перегляду/правки без UI.

**Функції з U3 (`369e018`, live на проді з 2026-08-08, ASTRYX_API_TOKEN ротовано, старий смоук-токен інвалідовано):**
- `update_host_rule(rule_id, *, behavior?, confidence?, status?, actor, note?)` — пише РІВНО передані поля, НІКОЛИ не бампає confidence (на відміну від `record_host_rule`) — це шлях людського редагування.
- `create_manual_rule(host, pattern, behavior, ...)` — новий рядок `source=human_override`; кидає `ValueError`, якщо такий `(host,persona,pattern,human_override)` вже є (не тихий бамп).
- `bulk_set_status(rule_ids, status, ...)`, `delete_host_rule`, `bulk_delete_rules` — з `rule_audit` записом на кожну зміну.

### `rules_api.py` — Flask Blueprint, `rules_bp`, зареєстрований в `astryx_survey_server.py:16`
**U1 (в проді, GET, read-only):** список правил з фільтрами, `/api/rules/<id>`, `/api/rules/compare`, `/api/rules/conflicts`, `/api/traces`, `/api/traces/<run_id>`, `/api/rules/report`, `/api/gate/<host>`.

**U3 (`369e018`, live, токен-гейт перевірено живим смоук-тестом):**
- `_require_astryx_token` — без `ASTRYX_API_TOKEN` в env → 503 на будь-якому мутуючому маршруті; є токен, заголовок `X-Astryx-Token` не збігається → 401.
- `PATCH /api/rules/<id>` — `{behavior?, confidence?, status?, note?}`.
- `POST /api/rules` — ручне створення, `{host, pattern, behavior, persona?, confidence?, status?}`, 409 на дублікат.
- `POST /api/rules/bulk` — `{ids[], op: promote|retire|delete, note?}`, одна транзакція.
- `POST /api/rules/<id>/resolve_conflict` — `{winner_id, loser_action: retire|delete}`, лише в межах одного `(host,persona,pattern)`.

### `astryx_survey_server.py` (789 рядків) — Flask control-plane, довгоживучий процес
- `PROFILES` (20) — дублікат мапи персон (для лейблів у /legacy та Telegram-повідомленнях).
- Черга задач (task queue), Telegram-тригер (`trigger_api`, 722).
- Режим Навчання (HITL): `training_mode_api` (640, увімк/вимк), `verify_step_api` (647, блокує підпроцес до людської дії, timeout 300с), `approve_step_api` (673), `override_step_api` (681, дуал-write в `host_rules` якщо є pattern, інакше плаский `record_fact`).
- Обслуговує `/legacy` (старий HTML template) і React SPA (`web/dist` на корені).

## 3. Інтерфейс (React SPA, `web/`)

Стек: React + React Router, побудовано Vite (білд-скрипт **вручну на dev-хості з npm/vite** — на телефоні немає build-середовища, готовий `web/dist/` заливається сюди/патчиться вручну при потребі, як це було з basename-фіксом).

**Роутинг** (`web/src/main.tsx`), обслуговується на **корені домену** `survey.exodus.pp.ua/` (НЕ на `/app`, це відхилення від первісного плану §4.2 S2 — сталось через міграцію на окремий піддомен):
```
/               → redirect → /rules
/rules          → RulesTable.tsx     — таблиця всіх host_rules з фільтрами
/rules/compare  → Compare.tsx        — порівняння правил між хостами
/rules/conflicts→ Conflicts.tsx      — той самий pattern, різні source/behavior
/traces         → Traces.tsx         — список run_traces
/traces/:runId  → Traces.tsx         — деталі одного прогону
/report         → Report.tsx (screens/audit/) — markdown/mermaid звіт
*               → redirect → /rules
```
Каркас: `shell/AppShell.tsx` + `shell/Nav.tsx` + `shell/StatusBar.tsx`. API-шар: `api/client.ts` (`getApiBase`/`getAppBasename`/`apiFetch`) + `api/hooks.ts`.

**Спостереження, не досліджено глибше**: `screens/rules/RuleDetail.tsx` і `screens/audit/TraceDetail.tsx` існують як компоненти, але не мають власного `<Route>` в таблиці вище — або орфан, або рендеряться умовно всередині `RulesTable`/`Traces`. Перевірити, якщо береш U3-UI в роботу.

**`/legacy`** — стара Flask HTML-сторінка (`ASTRYX_HTML_TEMPLATE` в `astryx_survey_server.py`), єдине зараз місце, де людина бачить живий прогін опитування і може його коригувати (Режим Навчання: verify/approve/override кнопки). Буде видалено в U6, після того як U5 перенесе цю функціональність у SPA.

## 4. Статус фаз (U0-U6, план `docs/plan-ui-astryx-addendum.md`)

| Фаза | Що | Статус | Де |
|---|---|---|---|
| U0 | `rules_report.py` + `pattern-vocabulary.md` | ✅ готово | корінь репо, `docs/` |
| U1 | `rules_api.py` GET + blueprint | ✅ готово, в проді | `rules_api.py` |
| U2 | `web/` skeleton, read-only екрани | ✅ готово, АЛЕ SPA на `/` не `/app` (архітектурне відхилення від плану) | `web/src/**` |
| U3 | Мутації host_rules + `X-Astryx-Token` | ✅ live в проді, `369e018` запушено на origin/master 2026-08-08 | `rules_api.py`, `persona_graph_memory.py` |
| U4 | WAL + `busy_timeout` + `host_gates` + гейт у `bump_rule_outcome` | 🚧 в роботі на Oracle (диспатчено 2026-08-08, ще не завершено/не перевірено) | — |
| U5 | Портувати Режим Навчання (verify/approve/override) у React, жива візуалізація проходження опитування | ❌ не почато — найважливіша відсутня частина | — |
| U6 | Прибрати `/legacy`, редірект `/` → `/app/ops` | ❌ не почато | — |

**U3 верифікація на проді (2026-08-08, виконано перед push):** бекап `survey_graph.db` (`backups/survey_graph.db.pre-u3.20260808_235400`), живий смоук-тест — `PATCH` без токена→503, з неправильним токеном→401, подвійний `PATCH behavior`→confidence НЕ змінюється (0.7→0.7), `POST /api/rules` двічі→409 вдруге, `rule_audit` — 5 тестових мутацій → 5 відповідних рядків. Секрет `ASTRYX_API_TOKEN` згенеровано постійний (`~/.vydra-survey-profiles/astryx_api_token.secret`, chmod 600), вписано в `~/.termux/boot/start-survey-server.sh` для reboot-safety. Запушено `369e018` на `origin/master`.
