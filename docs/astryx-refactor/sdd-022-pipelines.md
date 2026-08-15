# SDD 022 — Два пайплайни: НАВЧАННЯ (A) і ВИКОНАННЯ (B)

**Гілка:** `astryx-ui-refactor` · **Дата:** 2026-08-15 · **Методика:** `/ssd` (Problem → Decision → Implementation → Verification Gates)
**Базовий коміт дослідження:** `bf8ce56`
**Джерело вимог:** `docs/astryx-refactor/opus-oracle-prompt-022-research.md`, розділи 1, 2, 4.

Усі твердження нижче мають посилання `file:line` на код базового коміту. Формулювань
«ймовірно» / «схоже» немає: там, де доказу з коду не вистачає, стоїть явна помітка
**НЕ ДОВЕДЕНО** з поясненням, чого саме бракує.

---

## Problem

Власник ставить два питання, на які поточна архітектура не дає прямої відповіді:

1. Де саме агент справді вчиться, а де лише імітує навчання (пише в базу те, що ніколи не читається)?
2. Які зупинки на людину принципові (капча, 2FA), а які — наслідок слабких правил, відсутньої
   пам'яті або звичайних багів?

Код обох пайплайнів переплетений: `survey_agent.py` (виконання) під час прогону синхронно
викликає HTTP-ендпоінт `astryx_survey_server.py` (навчання) і одночасно імпортує його модуль,
щоб напряму мутувати глобальний словник стану. Стан прогону розсипаний по рядкових прапорцях
у кількох файлах. Через це неможливо ані відповісти на питання 1–2, ані безпечно змінювати
одну частину, не зачепивши іншу.

---

## 1. Пайплайн A — НАВЧАННЯ (knowledge acquisition)

### 1.1 Карта потоку

```
                        ДЖЕРЕЛА ЗНАНЬ (усі — таблиці SQLite ~/.vydra-survey-profiles/survey_graph.db)
  ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────────┬──────────────┐
  │ personas     │ patterns     │ hosts +      │ browser_     │ ai_source_    │ nodes/edges  │
  │              │              │ providers    │ sources      │ config        │ («факти»)    │
  │ pgm.py:147   │ pgm.py:157   │ pgm.py:112   │ pgm.py:132   │ app_settings  │ pgm.py:38    │
  │ CRUD:        │ CRUD:        │ CRUD:        │ CRUD:        │ pgm.py:168    │ write:       │
  │ settings_    │ settings_    │ settings_    │ settings_    │ CRUD:         │ record_fact  │
  │ api.py:129   │ api.py:183   │ api.py:75    │ api.py:241   │ settings_     │ pgm.py:267   │
  │              │              │              │              │ api.py:341    │              │
  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴───────┬───────┴──────┬───────┘
         │              │              │              │               │              │
         ▼              ▼              ▼              ▼               ▼              ▼
   get_persona     list_patterns   provider       CDPClient      get_vision_     get_facts
   pgm.py:1538     pgm.py:1612     resolve        __init__       backend         pgm.py:290
         │         (survey_agent   pgm.py:451     cdp_client     vision.py:167        │
         │          .py:283)            │         .py:94              │               │
         │              │               │              │              │               │
         └──────────────┴───────────────┴──────────────┴──────────────┴───────────────┘
                                            │
                                            ▼
                    ╔═══════════════════════════════════════════════╗
                    ║   ПРОГІН (пайплайн B) — джерело сирих трейсів  ║
                    ║   survey_agent.py:212  цикл кроків            ║
                    ╚═══════════════════════════════════════════════╝
                                            │
              ┌─────────────────────────────┼──────────────────────────────┐
              │                             │                              │
              ▼ (крок за кроком)            ▼ (після прогону)              ▼ (після прогону)
   POST /api/survey/verify_step    reflection.classify_outcome    record_run_trace
   survey_agent.py:313             survey_agent.py:401            survey_agent.py:408
              │                    reflection.py:100              pgm.py:645
              ▼                             │                              │
   ЛЮДИНА у Режимі Навчання                 ▼                              ▼
   astryx_survey_server.py:996      reflection.reflect              run_traces (40/хост)
   блокує крок до 300 с             survey_agent.py:416             + async_review_queue
              │                     reflection.py:151              pgm.py:673
      ┌───────┴────────┐                    │                              │
      ▼                ▼                    ▼                              ▼
  approve         override_step      lessons[] (rule-based,        SynapseAdapter
  :1023           :1103              БЕЗ LLM: reflection.py:157)   .sync_trace_async
  (нічого                │                   │                     pgm.py:694
   не пишеться)          ▼                   ▼                     (write-only,
                  record_host_rule    record_host_rule              див. sdd-022-synapse.md)
                  source=human_       source=self_reflection
                  override, conf=0.9  status=shadow, conf 0.4–0.5
                  status=shadow       survey_agent.py:428
                  astryx_survey_
                  server.py:1150
                         │                   │
                         └─────────┬─────────┘
                                   ▼
                        host_rules (status='shadow')
                                pgm.py:56
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
  ЛЮДИНА промотує          auto_promote_rules          bump_rule_outcome
  approve_host_gate        pgm.py:600                  pgm.py:561
  rules_api.py:646         (потребує ≥3 УНІКАЛЬНИХ     wins/losses,
  resolve_conflict         run_id у rule_applications) retire при
  rules_api.py:587         ⛔ НІКОЛИ не спрацьовує     losses≥3 і losses>wins
  PATCH /api/rules/<id>       у продакшені —          pgm.py:589
  rules_api.py:518            див. дефект D1
        │                          │                           │
        └──────────────────────────┴───────────────────────────┘
                                   ▼
                       host_rules (status='active')
                                   │
                                   ▼
                        ГЕЙТ ХОСТА host_gates
                        playbook_mode='active'?
                        pgm.py:104, читання pgm.py:1173
                          ┌────────┴────────┐
                     так  │                 │  ні (shadow/off/невизначено)
                          ▼                 ▼
                 текст правил               лише лог sha256
                 додається у промпт         pgm.py:1187
                 pgm.py:1183                (у прогін НЕ потрапляє)
                          │
                          ▼
                  ПАЙПЛАЙН B (наступний прогін)
```

`pgm.py` = `persona_graph_memory.py`.

### 1.2 Таблиця «крок → код → сховище → хто вирішує»

| # | Крок | Код (file:line) | Сховище | Хто вирішує |
|---|---|---|---|---|
| A1 | Реєстрація персони | `settings_api.py:138` → `persona_graph_memory.py:1538` | `personas` | людина (UI) |
| A2 | Реєстрація патерну (ключові слова теми) | `settings_api.py:192` → `persona_graph_memory.py:1612` | `patterns` | людина (UI) |
| A3 | Реєстрація провайдера/хоста | `settings_api.py:84`, `settings_api.py:30` | `providers`, `hosts` | людина (UI) |
| A4 | Реєстрація джерела браузера | `settings_api.py:250`, активація `settings_api.py:298` | `browser_sources` | людина (UI) |
| A5 | Вибір AI-джерела (проксі/локальна модель) | `settings_api.py:360` → читання `vision.py:167` | `app_settings.ai_source_config` | людина (UI) |
| A6 | Сирий трейс кроку | `survey_agent.py:340` (`trace_steps.append`) | оперативна пам'ять процесу | модель (Gemma) |
| A7 | Показ кроку людині | `survey_agent.py:313` → `astryx_survey_server.py:996` | `ACTIVE_SURVEY_STATE` (RAM) | модель пропонує |
| A8 | Затвердження кроку | `astryx_survey_server.py:1023` | **нічого не пишеться** | людина |
| A9 | Корекція кроку → правило | `astryx_survey_server.py:1103`, запис `:1150` | `host_rules` (shadow, conf 0.9) | людина |
| A10 | Класифікація результату прогону | `survey_agent.py:401` → `reflection.py:100` | — | детермінований код |
| A11 | Саморефлексія → правила | `survey_agent.py:416` → `reflection.py:151`, запис `survey_agent.py:428` | `host_rules` (shadow, conf 0.4–0.5) | детермінований код (LLM-гілка не реалізована: `reflection.py:157`) |
| A12 | Захист від перезапису людських правил | `survey_agent.py:423-427` | — | код (skip, якщо є `human_override`) |
| A13 | Запис трейсу прогону | `survey_agent.py:408` → `persona_graph_memory.py:645` | `run_traces` (40 на хост, `:686`) | код |
| A14 | Черга розбору невдач | `persona_graph_memory.py:673` | `async_review_queue` | код пише, людина розбирає (`rules_api.py:168`) |
| A15 | Статистика правил | `survey_agent.py:413` → `persona_graph_memory.py:561` | `host_rules.wins/losses` | код |
| A16 | Автопромоція shadow→active | `persona_graph_memory.py:600` | `host_rules.status` | код — **мертвий шлях, дефект D1** |
| A17 | Ручна промоція / гейт хоста | `rules_api.py:646`, `rules_api.py:518`, `rules_api.py:587` | `host_rules.status`, `host_gates`, `rule_audit` | людина |
| A18 | Впорскування правил у промпт | `persona_graph_memory.py:1157-1189` | — | код, за гейтом хоста |
| A19 | Дзеркалення у Synapse | `persona_graph_memory.py:417`, `persona_graph_memory.py:694` | зовнішній Synapse HTTP API | код (fire-and-forget) |

### 1.3 Скільки кроків HITL на одне правило

Мінімум **два** окремих людських рішення, розділених у часі, перш ніж правило вплине на прогін:

1. Корекція кроку у Режимі Навчання → `record_host_rule(..., status="shadow")` (`astryx_survey_server.py:1150`).
2. `POST /api/gate/<host>/approve` (`rules_api.py:646`) — одним викликом промотує переглянуті
   shadow-правила цього хоста (`rules_api.py:669-684`) і вмикає `playbook_mode='active'`
   (`rules_api.py:687`). Без кроку 2 правило не потрапляє у промпт навіть у статусі `active`,
   бо `get_enhanced_persona` перевіряє гейт окремо (`persona_graph_memory.py:1172-1189`).

Якщо промоція робиться не через гейт-екран, а поштучно (`PATCH /api/rules/<id>`,
`rules_api.py:518`), кроків стає **три**.

### 1.4 Що зберігається між прогонами, а що втрачається

**Зберігається** (SQLite `~/.vydra-survey-profiles/survey_graph.db`, `persona_graph_memory.py:35`):
`host_rules`, `run_traces` (обрізається до 40 на хост, `:686`), `rule_audit`, `rule_applications`
(на практиці порожня — дефект D1), `async_review_queue`, `nodes`/`edges`, `app_settings`,
`providers`, `hosts`, `personas`, `patterns`, `browser_sources`.

**Втрачається при перезапуску сервера** (лише RAM):
`ACTIVE_SURVEY_STATE` (`astryx_survey_server.py:72`), `PENDING_TASKS` (`:68`),
`RECENT_TELEGRAM_PUSHES` (`:126`, кільце на 50), `log_history` (`:117`, кільце на 200),
`TELEGRAM_LISTENER_STATE` (`:120`), `CURRENT_PROC` (`:69`).

**Втрачається/осиротіє на диску:** скріншоти кроків пишуться у `tempfile.mkdtemp`
(`survey_agent.py:180`) і ніколи не прибираються та не прив'язуються до `run_traces`;
у трейс потрапляє лише текст питання, обрізаний до 120 символів (`survey_agent.py:340`),
фінальний текст — до 2000 (`persona_graph_memory.py:657`).

### 1.5 LLM-виклики, проксі, кешування

| Виклик | Код | Транспорт | Кеш/дедуп |
|---|---|---|---|
| Рішення по кроку (vision) | `survey_agent.py:297` → `vision.py:207` | `POST {base}/v1/chat/completions`, `max_tokens=512`, `temperature=0.2` (`vision.py:60-84`); дефолт `AEGIS_PROXY_URL=http://192.168.3.184:18880` (`vision.py:21`) | **немає** |
| Локальна альтернатива | `vision.py:119-164` | `llama-mtmd-cli`, `-c 4096 -n 512 --temp 0.2 -t 4` | **немає** |
| Проба моделей | `settings_api.py:457-553` | HTTP до того ж проксі | статус у RAM |
| Рефлексія | `reflection.py:151` | LLM-гілка **не реалізована** (`reflection.py:157-159`) | — |

Вартість на кожному кроці, окрім самого запиту до моделі:
`get_vision_backend()` (`vision.py:167`) щоразу читає `ai_source_config` через `get_setting`,
а кожен `_connect()` (`persona_graph_memory.py:214`) виконує повний `executescript(SCHEMA)` і
п'ять `ALTER TABLE` у `try/except` (`:224-243`). Скріншот щоразу читається з диска й кодується
у base64 (`vision.py:56-58`). Об'єкт бекенда створюється заново на кожен крок.

---

## 2. Пайплайн B — ВИКОНАННЯ (autonomous survey run)

### 2.1 Повний шлях

```
Telegram-повідомлення
  telegram_listener_thread   astryx_survey_server.py:341   (long-poll getUpdates, 20 с)
        │
        ▼
  extract_text_and_url_from_payload  :171   →   push_task_from_text  :270
        │                                              (профіль з тексту :272, дефолт 'arno' :277)
        ▼
  PENDING_TASKS + ACTIVE_SURVEY_STATE.status='waiting_auth'   :304, :332
        │
        ├── людина: POST /api/survey/authorize  :1196  ──┐
        └── таймер 10 хв: auto_start_timer_thread :390 ──┤
                                                        ▼
                                     run_survey_execution  :409
                                     subprocess ~/llm-switch.sh survey <profile> <url> -f  :416
                                                        │
                                                        ▼
                                     ┌──────────  survey_agent.py:124  main()  ──────────┐
                                     │ start_run_trace                      :156         │
                                     │ heavy_state_busy (шлюз GPU, exit 409):160         │
                                     │ load_persona → get_enhanced_persona  :172 / :77   │
                                     │ load_credentials                     :174         │
                                     │ CDPClient(...)  ← поза try/finally    :177         │
                                     │ attach_or_open_tab / attach_exact_tab:188-190     │
                                     │ current_url = get_current_url()      :191  (1 раз)│
                                     │ гілка: активна вкладка / логін / навігація :194-207│
                                     └───────────────────────┬───────────────────────────┘
                                                             ▼
                                         ЦИКЛ КРОКІВ  survey_agent.py:212  (max_steps=60)
                                                             │
       ┌──────────────┬───────────────┬─────────────┬────────┴─────────┬──────────────┐
       ▼              ▼               ▼             ▼                  ▼              ▼
  detect_captcha  screenshot      page_text     detect_pattern    decide_action   verify_step
  :213            :278            :279          :295              :297            :313
  cdp_client      cdp_client      cdp_client    reflection.py:77  vision.py:207   POST :5005
  .py:605         .py:363         .py:324                                          (bare except :332)
       │                                                                                │
       │ якщо капча → waiting_verification + Telegram + очікування 600 с :221-275        │
       │                                                                                ▼
       │                                                                    override_action?
       │                                                                    :327-331
       ▼
  диспетчер дій  :335-377
    done   → completed=True, break                        :342
    click  → click_by_text → fallback find_submit_button  :358-367
    type   → click_by_text + type_text                    :368-371
    scroll → scroll                                       :372
    інше   → stop_reason='unknown_action', break          :374-377
                                                             │
                                                             ▼
                              ФІНАЛІЗАЦІЯ  survey_agent.py:390-434
                              record_survey_outcome            :394
                              classify_outcome                 :401
                              record_run_trace                 :408
                              bump_rule_outcome                :413   ← дефект D1
                              reflect → record_host_rule       :416-432
                                                             │
                                                             ▼
                              client.close()  :436  (finally)
                              proc.returncode → status finished/error  astryx_survey_server.py:430-438
```

### 2.2 Точки зупинки на людину

| Стан | Код | Тригер | Вихід |
|---|---|---|---|
| `waiting_auth` | `astryx_survey_server.py:304`, `:332` | нове завдання з Telegram | людина `authorize` (`:1196`) або автостарт через 10 хв (`:390-407`) |
| `waiting_verification` (навчання) | `astryx_survey_server.py:1009` | кожен крок, поки `training_mode=True` (дефолт `True`, `:82`) | `approve` (`:1023`), `skip` (`:1032`), `override` (`:1103`) або таймаут 300 с (`:1015`) → крок вважається схваленим (`:1019`) |
| `waiting_verification` (капча) | `survey_agent.py:231` | `detect_captcha_signatures()` (`cdp_client.py:605`) | `resume_after_captcha` (`:1047`), зникнення капчі з DOM (`survey_agent.py:259`), або таймаут 600 с (`:244`) |
| `paused` | `astryx_survey_server.py:1040` | ручна пауза | лише зміна стану; цикл агента цей стан не читає — див. F11 |
| ручний resume у вкладці | `astryx_survey_server.py:953` → `survey_agent.py:186` | людина відкрила вкладку сама | `--resume-tab` |

### 2.3 Перелік точок відмови з класифікацією

**Класи:** `[непереборне людське]` · `[лікується правилом]` · `[лікується пам'яттю]` · `[баг]`

| # | Точка відмови | file:line | Клас | Пояснення |
|---|---|---|---|---|
| F1 | Капча / анти-бот челендж | `survey_agent.py:213`, `cdp_client.py:605-645` | **[непереборне людське]** | hCaptcha/reCAPTCHA/Arkose/DataDome. Обробка коректна: пауза, Telegram-нотифікація, очікування 600 с, детект зняття капчі. |
| F2 | Перший логін / 2FA на панелі | `survey_agent.py:196-201`, `auth.py` | **[непереборне людське]** для першого разу; **[лікується пам'яттю]** далі | `credentials.json` (`survey_agent.py:83-89`) заповнюється вручну поза застосунком; збереженого cookie-стану немає. |
| F3 | Автопромоція правил ніколи не спрацьовує | `survey_agent.py:413` vs `persona_graph_memory.py:561`, `:600-621` | **[баг]** (D1, критичний) | Єдиний продакшн-виклик передає `bump_rule_outcome(applied_rule_ids, outcome)` без `run_id`. За `run_id=""` рядок у `rule_applications` не пишеться (`:578-582`). `auto_promote_rules` вимагає `COUNT(DISTINCT run_id) >= 3` саме з `rule_applications` (`:613-618`) → умова недосяжна. Усі тести передають `run_id` явно (`tests/regression/test_codebase_audit_bugs.py:43`), тому дефект зелений на тестах і мертвий у продакшені. |
| F4 | Знання з A не читаються, поки хост не «загейтений» | `persona_graph_memory.py:1159`, `:1172-1189` | **[лікується правилом]** | `include_shadow=False` + `playbook_mode` має бути `active`. Дефолт без рядка в `host_gates` — env `VYDRA_PLAYBOOK` (`:1179`), який зазвичай не заданий → shadow → правила лише логуються (`:1187`). |
| F5 | Правила читаються один раз, до редиректу | `survey_agent.py:77`, `:172` | **[лікується пам'яттю]** | `get_enhanced_persona` викликається до відкриття вкладки, з `args.url`. Після редиректу на домен провайдера (`keyresponses`, `qualtrics`, …) правила для реального хоста не підвантажуються. |
| F6 | `current_url` не оновлюється в циклі | `survey_agent.py:191` (єдине присвоєння) | **[баг]** | У `verify_step` (`:319`) і в Telegram-нотифікацію про капчу (`:224`) йде URL стартової сторінки, а не поточної. |
| F7 | Нова вкладка після кліку не підхоплюється | `cdp_client.py:203` (`check_and_attach_new_tab` не викликається ніде) | **[баг]** | Метод написаний і мертвий. Якщо опитування відкривається в новій вкладці, агент далі знімає скріншоти старої. |
| F8 | `EXACT_LAYOUT`-правила недосяжні | `persona_graph_memory.py:340` (лише тести), `:1159` (виклик без `structure_hash`) | **[баг]** / мертва фіча | Рівень 1 ієрархії скоупів (`:493-496`) у продакшені не може збігтися: `structure_hash` під час прогону не обчислюється. |
| F9 | Виняток vision вбиває прогін | `survey_agent.py:298-300` → `:374-377` | **[баг]** | На помилці підставляється `{"action": "wait"}`, але `"wait"` не оброблено в диспетчері → `stop_reason='unknown_action'` → `break`. Один тайм-аут проксі = кінець прогону. Ретраю немає. |
| F10 | Тихий провал моста до тутора | `survey_agent.py:332-333` | **[баг]** | Увесь блок `verify_step` під `except Exception: pass`. Якщо сервер :5005 недоступний або токен невірний, крок мовчки виконується автономно, а оператор нічого не бачить. |
| F11 | `paused` не зупиняє агента | `astryx_survey_server.py:1040-1045` | **[баг]** | Стан пишеться в `ACTIVE_SURVEY_STATE`, але цикл `survey_agent.py:212` читає стан сервера лише всередині гілки капчі (`:246-259`). Поза капчею пауза не діє. |
| F12 | Ціль не знайдена → крок пропускається без ретраю | `survey_agent.py:359-367` | **[лікується правилом]** | Фолбек лише на `find_submit_button`; немає повторного скріншоту, скролу чи другої спроби. |
| F13 | Збій усіх browser_sources рве прогін без запису | `survey_agent.py:177` (поза `try`), `cdp_client.py:134-137` | **[баг]** | `start_run_trace` уже створив рядок (`:156`); `CDPError` летить далі, `record_run_trace` не викликається → у `run_traces` лишається «вічно відкритий» прогін без `outcome`. |
| F14 | Факти («реальні відповіді») ніколи не поповнюються | `survey_agent.py:394` (виклик без `learned_facts`), `persona_graph_memory.py:1215-1217` | **[баг]** / незавершена фіча | `record_fact` у продакшн-шляху не викликається взагалі: лише сід (`persona_graph_memory.py:1848-1856`) і CLI (`:2034`). Секція «РАНІШЕ ЗАФІКСОВАНІ РЕАЛЬНІ ВІДПОВІДІ» (`:1145`) показує тільки засіяні дані. |
| F15 | Обрізання правил у промпті без попередження | `persona_graph_memory.py:1161-1168` | **[лікується правилом]** | Топ-12 правил і 1500 символів; решта тихо відкидається, пріоритет — лише `confidence`. |
| F16 | Обмеження `max_steps=60` | `survey_agent.py:136`, `:386-388` | **[лікується правилом]** | Довге опитування завершується як `incomplete`. |
| F17 | Ненульовий код виходу процесу — без відновлення | `astryx_survey_server.py:430-438` | **[лікується пам'яттю]** | Ретраю/резюме немає; лише ручний `--resume-tab` (`:953`). |
| F18 | Bounding boxes не надсилаються | `cdp_client.py:595` не викликається; `astryx_survey_server.py:1005` завжди отримує `[]` | **[баг]** | Оверлей у UI не має даних. |
| F19 | Скріншоти осиротіли | `survey_agent.py:180`, `:437` | **[баг-lite]** | `mkdtemp` без прибирання і без зв'язку з `run_traces`. |
| F20 | `training_mode` за замовчуванням увімкнено | `astryx_survey_server.py:82` | **[лікується правилом]** | Кожен крок автономного прогону чекає людину до 300 с; після таймауту крок вважається схваленим (`:1015-1019`). |

**Підсумок класифікації:** принципово людських точок — 2 (F1, F2-перший-раз).
Багів — 10 (F3, F6, F7, F8, F9, F10, F11, F13, F14, F18, F19). Лікується правилами — 5.
Лікується пам'яттю — 3.

### 2.4 Чи використовуються знання з A під час прогону (гейт G3)

**Відповідь однозначна: частково — і саме та частина, що мала б робити агента розумнішим,
у продакшені не працює.**

Доказ з коду, три канали:

1. **Канал «факти» — мертвий на запис.** Читається (`persona_graph_memory.py:1141` →
   `get_facts`, `:290`), впорскується у промпт (`:1145-1155`). Але жоден продакшн-шлях не
   викликає `record_fact`: `survey_agent.py:394` викликає `record_survey_outcome` без
   `learned_facts`, а `record_fact` спрацьовує лише всередині `if learned_facts:`
   (`persona_graph_memory.py:1215-1217`). Інші виклики — сід (`:1848-1856`) і CLI (`:2034`).
   → у промпт потрапляють лише засіяні вручну факти.

2. **Канал «правила» — читається, але за подвійним замком.** `survey_agent.py:77` →
   `get_enhanced_persona` → `get_host_rules(host, profile_key, include_shadow=False)`
   (`persona_graph_memory.py:1159`). Замок 1: лише `status='active'`. Замок 2: текст
   додається у промпт тільки якщо `host_gates.playbook_mode == 'active'`
   (`:1183`); інакше — рядок `[shadow] would-add host_rules section …` (`:1187`).

3. **Шлях shadow → active автоматично не існує.** Дефект F3/D1 вище: `rule_applications`
   у продакшені не заповнюється, тому `auto_promote_rules` (`:600`) не може промотувати нічого.
   Єдиний робочий шлях — ручний (`rules_api.py:646`, `:518`, `:587`).

**Висновок:** агент не «вчиться заново» кожного прогону в буквальному сенсі — записи в базу
лишаються. Але без двох ручних дій людини на кожен хост накопичене знання не впливає на
поведінку жодного наступного прогону, а канал фактів не поповнюється взагалі. Практично
поведінка агента між прогонами не змінюється сама по собі.

---

## 3. Synapse

Винесено в окремий документ: `docs/astryx-refactor/sdd-022-synapse.md`.

---

## Decision (розділ 4 — обмежений рефакторинг)

### 4.1 Що дозволено і що з цього випливає з розділів 1–2

| Дозволена дія (з промту) | Що конкретно випливає з дослідження |
|---|---|
| виділити межі між A і B | Міст B→A — це один інлайн-блок `urllib` у гарячому циклі (`survey_agent.py:310-333`) плюс прямі мутації чужого глобального словника (`survey_agent.py:229-240`, `:248-252`, `:262-269`). Виносимо в модуль `pipeline_bridge.py` з двома функціями: `verify_step()` і `report_blocking()`. |
| зробити стан прогону явним | Рядкові літерали станів розсипані по `astryx_survey_server.py` (`:73`, `:332`, `:401`, `:412`, `:431`, `:1009`, `:1018`, `:1043`, `:1050`, `:1070`, `:1203`, `:1224`) і по `survey_agent.py` (`:231`, `:254`, `:259`, `:265`). Створюємо `run_state.py` з константами і таблицею дозволених переходів; підставляємо константи (значення рядків не змінюються). |
| прибрати дублювання LLM-викликів і кеш для детермінованих промтів | Дублювання — не в самих запитах до моделі (кожен крок має унікальний скріншот), а в **побудові бекенда**: `get_vision_backend()` (`vision.py:167`) на кожному кроці читає `ai_source_config` через `_connect()`, який щоразу проганяє повний `executescript(SCHEMA)` + 5 `ALTER TABLE` (`persona_graph_memory.py:214-243`). Кешуємо бекенд за ключем конфігурації. |

### 4.2 Що свідомо НЕ робиться

- **Дефекти F3, F6, F7, F9, F10, F11, F13, F14 не виправляються в межах 022.** Кожен із них
  змінює поведінку прогону, а гейт G6 вимагає ідентичної кількості кроків і однакового
  outcome «до» і «після». Виправлення F3 (передати `run_id`) вмикає автопромоцію правил —
  це зміна поведінки за визначенням. Виносимо у Feature 023 з окремими гейтами.
- Кеш відповідей моделі за промтом — відхилено: промпт містить номер кроку (`vision.py:211`)
  і унікальний скріншот, детермінованого повтору немає, а кеш по зображенню створив би ризик
  «залипання» на однаковій сторінці.
- UI, схема БД, auth/секрети, масові перейменування — заборонені промтом.

### 4.3 Стан виконання розділу 4 — ЗАБЛОКОВАНО

Код рефакторингу **не написаний** у цій сесії. Причина — обов'язкове правило проєкту
(`CLAUDE.md`, розділ «Always Do»):

> **MUST run impact analysis before editing any symbol.** … NEVER edit a function, class, or
> method without first running `impact` on it.

Інструменти gitnexus (`impact`, `detect_changes`, `query`, `context`) у цій сесії недоступні:
MCP-сервер відповідає відмовою в дозволі, локального індексу `.gitnexus/` у репозиторії немає,
мережа для `npx gitnexus analyze` закрита. Виконати обов'язкову передумову редагування
неможливо, тому редагування не почалося. Додатково у цій сесії заблоковано запуск `python3`,
`bash bin/*.sh` і мережу, тобто гейти G5/G6 усе одно не були б доведені.

Нижче — повна специфікація рефакторингу, готова до застосування на .184/Oracle, де
gitnexus і запуск скриптів доступні.

---

## Implementation (специфікація для застосування)

### R1 — `pipeline_bridge.py` (новий файл): межа B → A

Перенести без змін логіки тіло блоку `survey_agent.py:310-333` у функцію:

```python
def verify_step(*, step, shot_path, decision, profile, url, page_text, pattern,
                endpoint="http://127.0.0.1:5005/api/survey/verify_step",
                timeout=300):
    """Синхронний міст до пайплайну навчання. Повертає dict override-полів
    або None, якщо тутор недоступний. Поведінка ідентична інлайн-блоку:
    будь-яка помилка мережі проковтується."""
```

і блоку `survey_agent.py:228-269` (мутації `ACTIVE_SURVEY_STATE`) у функції
`report_blocking(reason_code, decision)` / `poll_operator_status()`.

Умова еквівалентності: той самий таймаут (300 с), той самий заголовок
`X-Astryx-Token` з `ASTRYX_API_TOKEN`, той самий зріз `page_text[:2000]`, той самий
`except Exception: pass`. Виклик у циклі стає одним рядком.

Ризик: LOW (чисте перенесення, один call-site).

### R2 — `run_state.py` (новий файл): явна машина станів

```python
IDLE = "idle"; WAITING_AUTH = "waiting_auth"; STARTING = "starting"
RUNNING = "running"; WAITING_VERIFICATION = "waiting_verification"
PAUSED = "paused"; FINISHED = "finished"; ERROR = "error"

ALLOWED = {
    IDLE:                 {WAITING_AUTH, STARTING},
    WAITING_AUTH:         {STARTING, IDLE},
    STARTING:             {RUNNING, ERROR, IDLE},
    RUNNING:              {WAITING_VERIFICATION, PAUSED, FINISHED, ERROR, IDLE},
    WAITING_VERIFICATION: {RUNNING, IDLE, ERROR},
    PAUSED:               {RUNNING, IDLE},
    FINISHED:             {IDLE, WAITING_AUTH},
    ERROR:                {IDLE, WAITING_AUTH},
}
```

Підстановка констант замість літералів у перелічених у 4.1 рядках. Значення рядків
не змінюються, тому зовнішній контракт API і фронтенду лишається тим самим.
Валідацію переходів (`assert`/лог) додавати **у режимі лише-логування**, без блокування,
щоб не змінити поведінку.

Ризик: MEDIUM (багато call-sites у `astryx_survey_server.py`) — саме тому потрібен
`impact({target: "ACTIVE_SURVEY_STATE", direction: "upstream"})` перед застосуванням.

### R3 — кеш бекенда vision

У `vision.py:167`:

```python
_BACKEND_CACHE: dict[str, BaseVisionBackend] = {}

def get_vision_backend() -> BaseVisionBackend:
    import persona_graph_memory
    cfg_str = persona_graph_memory.get_setting("ai_source_config") or ""
    cached = _BACKEND_CACHE.get(cfg_str)
    if cached is not None:
        return cached
    backend = _build_vision_backend(cfg_str)   # поточне тіло функції
    _BACKEND_CACHE.clear()
    _BACKEND_CACHE[cfg_str] = backend
    return backend
```

Ключ — сам рядок конфігурації, тому зміна налаштування у UI миттєво дає новий бекенд.
Бекенди без стану (`vision.py:43-96`, `:111-164`), тому перевикористання безпечне.
Економія: один `_connect()` + `executescript(SCHEMA)` + 5 `ALTER TABLE` на кожен крок
прогону (60 кроків максимум) — зникає лише повторна побудова, читання налаштування
лишається (щоб UI-зміна підхоплювалась).

Ризик: LOW (одна функція, немає зовнішніх викликів окрім `GemmaVision.run_vision`,
`vision.py:201`).

---

## Verification Gates

| Гейт | Команда | Очікуваний вивід | Статус у цій сесії |
|---|---|---|---|
| G0 | `node .gitnexus/run.cjs analyze` (або `npx gitnexus analyze`) | кількість проіндексованих файлів | **FAIL — заблоковано** (немає індексу, немає мережі, MCP заборонено) |
| G1 | огляд розділу 1.2 | ≥1 `file:line` на кожен крок, без «ймовірно» | **PASS** (19/19 кроків) |
| G2 | огляд розділу 2.3 | ≥1 `file:line` + клас на кожну точку відмови | **PASS** (20/20 точок) |
| G3 | розділ 2.4 | однозначна відповідь із доказом | **PASS** |
| G4 | див. `sdd-022-synapse.md` | контракт відтворено або доведено відсутність | **PASS** |
| G5 | `bash bin/ui_verify.sh && bash bin/deploy_verify.sh && bash bin/ops_verify.sh` | exit 0 у всіх трьох | **FAIL — заблоковано** (запуск скриптів і мережа недоступні); еквівалентні grep-інваріанти зняті вручну, див. `claude-audit-022.md` |
| G6 | живий прогін до/після | однакові кроки й outcome | **FAIL — заблоковано** (`~/llm-switch.sh` відсутній на dev-184, підтверджено ще в `claude-audit-021C.md`; коду рефакторингу немає) |

Детальний журнал гейтів з командами та фактичним виводом: `docs/astryx-refactor/claude-audit-022.md`.
