# Архітектурний план інтеграції довготривалої пам'яті Synapse у проєкт `vydra-swiss-survey` (Ревізія 2.0)

> **Статус:** ✅ 100% Реалізовано у фічі `002-synapse-integration` (модуль `synapse_adapter.py`, regression-тести `test_synapse_adapter_protocol.py`)  
> **Дата:** 12 серпня 2026 року (Оновлено після реалізації)  
> **Базове дослідження:** Технічний звіт *"Архітектурний рев'ю пам'яті Synapse"* (Orange Pi 5, Streamable HTTP MCP, one-way adapter sync)  
> **Цільовий репозиторій:** `vydra-swiss-survey` (`/storage/emulated/0/Projects/vydra-swiss-survey`, symlink: `~/vydra-swiss-survey`)

---

## 1. Аналіз реальної схеми даних `persona_graph_memory.py` та usage в `rules_api.py`/`survey_agent.py`

### 1.1. Огляд структури даних SQLite (`survey_graph.db`) — Верифіковано на живій кодовій базі
На основі перевірки вихідного коду у поточному стані репозиторію, функціонують **12 системних таблиць**:

| Таблиця | Опис і призначення | Ключові поля | Частота запису / Запитувачі |
|---|---|---|---|
| **`nodes`** | Графові вузли фактів персон, самих персон та опитувань | `id` (PK), `type` (`fact`/`persona`/`survey`), `label`, `persona`, `topic`, `created_at` | Низька/середня. `record_fact()` (L218) під час/в кінці опитування. |
| **`edges`** | Графові ребра зв'язків між вузлами | `id` (PK), `src`, `dst`, `relation` (`HAS_FACT`, `RECORDED_IN`), `created_at` | Додається синхронно з `nodes` у `_add_edge()` (L211). |
| **`host_rules`** | Рушій правил поведінки та фільтрів скринінгу по хостах | `id` (PK), `host`, `persona`, `pattern`, `behavior`, `source`, `status` (`shadow`/`active`/`retired`), `confidence`, `hits`, `wins`, `losses`, `evidence`, `created_at`, `updated_at` | `reflect()` (reflection.py:147), `override_step()` (astryx_survey_server.py:823), `bump_rule_outcome()` (L363). |
| **`run_traces`** | Повний лог виконання сесій опитувань | `run_id` (PK), `persona`, `host`, `url`, `started_at`, `ended_at`, `outcome`, `outcome_reason`, `final_text`, `steps_json`, `rules_used` | **1 запис на кожен прогін** у `survey_agent.py:351` via `record_run_trace()` (L420). Великий обсяг через `steps_json`. |
| **`rule_audit`** | Аудит дій з правилами (редагування, промоція, конфлікти) | `id` (PK), `rule_id`, `actor`, `action`, `before_json`, `after_json`, `note`, `created_at` | Записується у `record_rule_audit()` (L620) при кожній мутації в `rules_api.py`. |
| **`host_gates`** | Перемикач режимів плейбука хоста | `host` (PK), `playbook_mode` (`off`/`shadow`/`active`), `updated_at`, `updated_by` | Оновлюється у `set_host_gate()` (L832) via `POST /api/gate/<host>/approve`. |
| **`providers`** | Провайдери опитувань (Bilendi, Meinungsplatz, GfK тощо) | `id` (PK), `key` (UNIQUE), `label`, `url_pattern`, `note`, `created_at`, `updated_at` | Рідкісні системні зміни via `create_provider()` (L972). |
| **`hosts`** | Хости опитувальників з прив'язкою до провайдерів | `id` (PK), `hostname` (UNIQUE), `label`, `provider_id`, `note`, `created_at`, `updated_at` | Рідкісні системні зміни via `create_host()` (L1044). |
| **`browser_sources`** | Мережеві джерела CDP/MCP для керування браузером | `id` (PK), `key` (UNIQUE), `label`, `kind`, `host`, `port`, `mcp_server`, `note`, `is_active` | Конфігурація інфраструктури via `create_browser_source()` (L1114). |
| **`personas`** | Метадані персон (активність, опис) | `id` (PK), `key` (UNIQUE), `label`, `content_md`, `active`, `created_at`, `updated_at` | Оновлюється via `update_persona()` (L1294). |
| **`patterns`** | Словник патернів поведінки (`pattern-vocabulary`) | `id` (PK), `key` (UNIQUE), `label`, `keywords` (JSON), `qualifying_polarity`, `is_builtin` | Довідник патернів (`reflection.py:73` / `TOPIC_KEYWORDS`). |
| **`app_settings`** | Глобальний Key-Value стор додатку | `key` (PK), `value`, `updated_at` | Системні налаштування додатку. |

### 1.2. Шляхи та точки запису з точними сигнатурами й рядками коду
1. **`record_fact(persona_key: str, topic: str, value: str, survey_url: str = "") -> None`** (`persona_graph_memory.py:218`):
   - Викликається у `record_survey_outcome()` (`persona_graph_memory.py:934` / `survey_agent.py:337`).
   - Атомарно перезаписує вузол `fact:persona:topic`, створює вузол `survey` та ребра `HAS_FACT`, `RECORDED_IN`.
2. **`record_host_rule(host: str, pattern: str, behavior: str, *, persona: str = "*", source: str = "self_reflection", status: str = "shadow", confidence: float = 0.5, evidence: Optional[dict] = None) -> None`** (`persona_graph_memory.py:291`):
   - Викликається у `astryx_survey_server.py:823` (Human override), `reflection.py:151` (`reflect()`), `survey_agent.py:371`.
   - Записує нове правило з `status='shadow'` або оновлює існуюче.
3. **`record_run_trace(run_id: str, *, outcome: str, outcome_reason: str, final_text: str = "", steps: list = None, persona: str = "", host: str = "", url: str = "", started_at: str = "", rules_used: list[int] = None) -> None`** (`persona_graph_memory.py:420`):
   - Викликається у `survey_agent.py:351` в момент завершення опитування.
   - Записує підсумковий результат, детальні кроки `steps_json` та `rules_used`.
4. **`bump_rule_outcome(rule_ids: list[int], outcome: str) -> None`** (`persona_graph_memory.py:363`):
   - Викликається у `survey_agent.py:350`.
   - Інкрементує `wins` або `losses` для всіх задіяних у прогоні правил.

---

## 2. EntityKey / Namespace Таксономія для Synapse

```
<domain>.<subdomain>.<entity_id>[.<attribute>]
```

### Таблиця таксономії всіх доменів пам'яті

| Домен пам'яті | Шаблон `entityKey` | Приклад `entityKey` | Потребує Tags-ізоляції? (Косинус ≥0.92 risk) | Тип запису у Synapse |
|---|---|---|---|---|
| **`persona_facts`** (Факти відповідей) | `persona.{persona_key}.{topic}` | `persona.arno.tobacco_smoker` | **ТАК:** `["persona:arno", "domain:fact"]` | **Single-Current-Value Fact** (supersedes старе) |
| **`persona_metadata`** (Статус/Бан/Джерело) | `persona.{persona_key}.meta.{attr}` | `persona.arno.meta.burnout_status` | **ТАК:** `["persona:arno", "domain:meta"]` | **Single-Current-Value Fact** |
| **`host_rules`** (Правила хостів) | `hostrule.{host}.{persona}.{pattern}` | `hostrule.meinungsplatz_ch.arno.tobacco` | **ТАК:** `["host:meinungsplatz_ch", "persona:arno", "pattern:tobacco"]` | **Single-Current-Value Fact** (оновлює версію) |
| **`host_gates`** (Режими плейбуків) | `hostgate.{host}` | `hostgate.bilendi_ch` | **ТАК:** `["domain:hostgate"]` | **Single-Current-Value Fact** |
| **`run_traces_summary`** (Підсумок прогону) | *Без entityKey* | *N/A (Episodic entry)* | **ТАК:** `["trace", "run:<run_id>", "host:bilendi_ch", "outcome:disqualified"]` | **Episodic-Log** (унікальний tag `run:<id>` запобігає dedup-злиттю) |
| **`pattern_vocabulary`** (Словник патернів) | `pattern.{pattern_key}` | `pattern.industry_exclusion` | **ТАК:** `["domain:pattern_vocabulary"]` | **Single-Current-Value Fact** |
| **`rule_conflicts`** (Конфлікти правил) | `conflict.{host}.{pattern}` | `conflict.bilendi_ch.alcohol` | **ТАК:** `["domain:conflict", "host:bilendi_ch"]` | **Single-Current-Value Fact** |
| **`provider_hosts`** (Мапінг провайдерів) | `provider.{provider_key}.host.{hostname}` | `provider.meinungsplatz.host.meinungsplatz_ch` | **ТАК:** `["domain:provider_mapping"]` | **Single-Current-Value Fact** |

---

## 3. Домени, які НЕ дублюються в Synapse (Source of Truth лише в `persona_graph_memory.py`)

1. **Критичні фільтри скринінгу `host_rules` під час виконання `survey_agent.py`:**
   - SQLite у `persona_graph_memory.py` залишається єдиним джерелом правди (Source of Truth) для живого проходження опитувань.
2. **Сирі DOM-кроки та HTML-дампи (`run_traces.steps_json`):**
   - У Synapse передається лише **згорнутий текстовий сабмарі прогону (`run_traces_summary`)**, сирий `steps_json` залишається тільки в локальній SQLite.
3. **Персональні дані відповіді (PII evidence):**
   - Поле `evidence` маскується або відсікається адаптером перед надсиланням у Synapse.
4. **Конфігурації CDP/MCP пристрою (`browser_sources`):**
   - Локальна мережева конфігурація не передається у Synapse.

---

## 4. Проєкт Adapter-шару (Односторонній Sync: `persona_graph_memory` → Synapse)

### 4.1. Архітектурна схема адаптера та спостережуваність

```
[ survey_agent.py / astryx_survey_server.py ]
                       │
                       ▼
       ┌──────────────────────────────┐
       │   persona_graph_memory.py    │ ◄── [ Source of Truth (SQLite WAL) ]
       └──────────────┬───────────────┘
                      │
        ┌─────────────┴─────────────┐
        │  SynapseAdapter (Python) │ ◄── [ Non-blocking Worker Thread + Metrics ]
        └─────────────┬─────────────┘
                      │  HTTP POST /v1/memories (Timeout = 500ms)
                      ▼
       ┌──────────────────────────────┐
       │     Synapse Hono REST API    │ ◄── [ Streamable HTTP / Orange Pi 5 ]
       └──────────────────────────────┘
```

---

## 5. Multi-Agent Access, Observability & Fail-Safe Архітектура

### 5.1. Повна ізоляція `survey_agent.py` та Спостережуваність Відмов (Observability)
- **Принцип:** `survey_agent.py` **НІКОЛИ не чекає на відповідь Synapse** і не блокується його таймаутами.
- **Спостережуваність (Delivery Metrics):**
  - Замість мовчазного `logger.warning`, адаптер веде лічильники доставки в таблиці `app_settings`:
    - `synapse_delivery_success_count`
    - `synapse_delivery_failure_count`
    - `synapse_last_success_at`
    - `synapse_consecutive_failures`
  - Додано CLI-команду перевірки стану: `python3 synapse_adapter.py --status`.
  - При `synapse_consecutive_failures >= 5` адаптер піднімає прапор `SYNAPSE_DEGRADED=True` і виводить червоне попередження в `rules_report.py` та Astryx UI.

---

## 6. Покроковий план дій для кодуючого агента `agy` (Roadmap & Acceptance Criteria)

### SPIKE TASK 0.1: Верифікація транспорту MCP та декомпозиція Streamable HTTP (ПЕРЕД Фазою 1)

> **Виправлення за зауваженням рев'ю:** У минулій версії пропонувався двоканальний SSE (`SSEServerTransport`). За актуальною специфікацією MCP (`modelcontextprotocol.io`) та `@modelcontextprotocol/sdk` (v1.5.0+), SSE в Hono вважається legacy. Використовується **Streamable HTTP** (`createMcpHandler` / `@modelcontextprotocol/hono`).

#### Декомпозиція та архітектурні рішення Spike Task 0.1:
1. **(a) Винесення інстанціювання McpServer та реєстрації інструментів:**
   - В `apps/mcp-server/src/index.ts` реєстрація інструментів (`memory_write`, `memory_retrieve`, `memory_digest`, `memory_feedback`) виноситься у спільний модуль `apps/core/src/mcp-tools.ts`.
2. **(b) Прив'язка McpServer до мережевого транспорту у Hono API:**
   - В `apps/api/src/routes/mcp.ts` створюється ендпоінт `/mcp` (Streamable HTTP) через `createMcpHandler` з обгорткою `createMcpHonoApp`.
3. **(c) Управління одночасними сесіями (Session Management):**
   - Для кожного HTTP-клієнта створюється екземпляр транспорту через stateless handler factory, що звертається до єдиного пулу бази даних `better-sqlite3`.

- **Критерії приймання Spike (Pass/Fail Gate):**
  - [ ] Підключення до `http://100.113.140.25:8787/mcp` через `npx @modelcontextprotocol/inspector`.
  - [ ] Успішне проходження capability negotiation (`tools/list`).
  - [ ] Реальний виклик інструменту `memory_retrieve` повертає статус HTTP 200 та валідний JSON-RPC масив пам'яті.
  - *План НЕ рухається далі до успішного закриття цього Spike Task.*

---

### Фаза 1: Форк та деплой Synapse на Orange Pi 5 (RK3588)

#### Task 1.1: Деплой Streamable HTTP MCP у сервіс Synapse Hono
- **Дія:** Інтегрувати модуль `apps/api/src/routes/mcp.ts` на основі Streamable HTTP.
- **Критерії приймання (AC):**
  - [ ] Ендпоінт `http://100.113.140.25:8787/mcp` приймає Streamable HTTP MCP запити.

#### Task 1.2: Компіляція та `systemd` конфігурація на Orange Pi 5
- **Дія:** Налаштувати `systemd` сервіс `synapse.service` на ARM64 Ubuntu/Debian.
- **Критерії приймання (AC):**
  - [ ] `systemctl status synapse` показує `active (running)`.

---

### Фаза 2: Створення Python Synapse Client & Adapter MVP

#### Task 2.1: Створити модуль `synapse_adapter.py`
- **Дія:** Реалізувати HTTP-клієнт з неблокуючим фоновим потоком, таймаутом (0.2s connect / 0.5s read) та фіксацією метрик доставки в `app_settings`.

#### Task 2.2: Інтегрувати hook в `record_host_rule()`
- **Дія:** Додати виклик `synapse_adapter.sync_host_rule(...)` в `persona_graph_memory.py:291`.

---

### ФАЗА 2.5 (НОВА): Staging & Shadow Delivery Phase (До живого трафіку)

> **Виправлення за зауваженням рев'ю:** Пряме включення нового адаптера на живих оплачуваних сесіях недопустиме.

- **Дія:**
  - Адаптер вмикається **виключно для тестової/неоплачуваної персони** (`persona:test_shadow`) на 3-5 днів.
  - Проводиться 100+ тестових прогонів.
  - Відстежується delivery rate через `python3 synapse_adapter.py --status`.
- **Критерії приймання Staging (AC):**
  - [ ] Delivery Success Rate ≥99.5% на 100+ тестових викликах.
  - [ ] Жодного впливу на швидкість проходження кроків тестових опитувань.
  - *Тільки після цього адаптер допускається до живих персон (`persona:arno`, `persona:annet`).*

---

### Фаза 3: Повне покриття всіх доменів пам'яті

#### Task 3.1: Покриття `record_fact()`, `host_gates` та `pattern-vocabulary`
- **Дія:** Інтегрувати адаптер у `record_fact()` (L218) та `set_host_gate()` (L832).

#### Task 3.2: Асинхронний сабмарайзер для `run_traces`
- **Дія:** Інтегрувати відправку підсумку прогону у `record_run_trace()` (L420).

---

### Фаза 4: Інтеграція мультиагентного доступу та Безпека токенів

#### Task 4.1: Безпека токенів та налаштування MCP конфігурації
- **Виправлення за зауваженням рев'ю:** Хардкод токенів у файлах конфігурації категорично вилучено.
- **Дія:**
  - [ ] **Крок 0:** Переконатися, що `.claude/mcp.json`, `.agents/mcp_config.json` та `synapse_credentials.json` додані у `.gitignore` **ДО того**, як з'являться токени.
  - [ ] **Крок 1:** Зберігати токен у локальному некомміченому файлі `~/.vydra_synapse_token` (`chmod 600`) або зчитувати з env-змінної `${SYNAPSE_TOKEN}`.
  - [ ] **Крок 2:** Прописати конфігурацію MCP з посиланням на змінні оточення або локальний некоммічений файл.

---

## 7. Ризики мультидоменної інтеграції (Multi-Domain Specific Risks)

| Ризик | Прояв у нашому мультидоменному кейсі | Метод запобігання / Виправлення |
|---|---|---|
| **1. Колізія `entityKey` між доменами** | Пересічення ключів між фактом персони та правилом хоста. | **Суворий префікс домену:** `persona.arno.tobacco` vs `hostrule.meinungsplatz.arno.tobacco`. |
| **2. Переповнення vector store через `run_traces`** | 100+ прогонів з дампами кроків забиватимуть векторний індекс. | **Фільтрація на рівні адаптера:** Сирий `steps_json` залишається у SQLite. У Synapse іде лише підсумок. |
| **3. Помилкове згасання (Decay Conflict)** | Підсумок прогону знижує важливість `host_rules`. | **Різні Importance Weights:** `host_rules` (`importance=1.0`, без decay), `run_traces_summary` (`importance=0.3`, decay 14 днів). |
| **4. Поглинання `run_traces_summary` через Semantic Dedup** | Багато прогонів з однаковим результатом ("completed, no issues") мають косинусну подібність ≥0.92 і зливаються в один факт. | **Унікалізуючий тег + timestamp:** Кожен підсумок ОБООВ'ЯЗКОВО містить унікальний тег `run:<run_id>` та явний `[RunID: <id>]` у тексті запису. |
| **5. Семантичне злиття фактів різних персон** | Злиття фактів Арно та Аннет при подібності ≥0.92. | **Обов'язкова isolation-тегувальна стратегія:** теги `persona:<key>` та унікальний `entityKey`. |
