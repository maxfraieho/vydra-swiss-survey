# Plan — 021-multiagent-sdd-extension

> **Проєкт:** `vydra-swiss-survey`
> **Гілка:** `astryx-ui-refactor`
> **Тип:** Integration (Шаблон 4) + Refactor (Шаблон 3) над SDD-інфраструктурою
> **Статус:** Затверджено після Шаблону 7 — див. `clarify.md`
> **Джерела:** живий SSH-аудит dev-184 (2026-08-17) +
> `/home/vokov/projects/Research/Multi-Agent SDD Workflow Extension.txt`
> (22 цитати, зовнішнє deep-research джерело)

---

## 0. Емпірично перевірений стан (dev-184, `astryx-ui-refactor`)

| Твердження | Результат | Доказ |
|---|---|---|
| `specify-cli` встановлений | ТАК, `v0.16.5.dev0` через `uv tool` | `uv tool list` |
| Версія в конституції (`v0.16.2`) відповідає реальності | НІ — дрейф на 3 мінор-ревізії | заголовок `constitution.md` |
| `.specify/integrations/` існує | НІ | `ls` |
| Native Spec Kit ініціалізований у репо | НІ — `.specify/` містить лише `constitution.md` | `ls -la .specify/` |
| `/speckit.*` команди реально викликаються | НІ | `find .claude -type f` |
| `specify integration install` доступний | ТАК | `specify integration --help` |
| `codex` встановлений на dev-184 | ТАК, `codex-cli 0.124.0`, `/usr/local/bin/codex` | `codex --version` |
| `.codex/prompts/` (проєктний) існує | НІ | `ls` |
| `agy` встановлений на dev-184 | НІ | `which agy` |
| `.agents/skills/sdd-workflow/SKILL.md` — валідний frontmatter | ТАК | `head` |
| `.specify/feature.json` або машинно-читний вказівник | НІ (є застарілий прозовий `HANDOFF.md`) | `head -40 HANDOFF.md` |
| Git-хуки встановлені | НІ — `.git/hooks/` порожній | `ls -la .git/hooks/` |
| LLM-проксі `192.168.3.184:18880` живий | ТАК, `401` на `/v1/models` (вимагає ключ) | `curl` |
| `bin/sdd_verify.sh` — динамічний валідатор | НІ — хардкод 32 шляхів | `cat` |

### 0.1 Критичні відкриття

1. **`agy` — `Multi-install Safe: no`** в каталозі Spec Kit; `claude`/`codex` — `yes`. AGY-шар мусить лишитись рукописним у `.agents/skills/`, не через `specify integration install agy` (закрито в `clarify.md` п.3).
2. **Нумерація `specs/` розсинхронізована по гілках:** `master` = `001..018`, `astryx-ui-refactor` = `001..016`+`020`. Глобальний максимум = `020` → ця фіча = `021` (закрито в `clarify.md` п.7).
3. **Підтверджений spec-drift:** коміти `astryx-ui-refactor` посилаються на неіснуючий `specs/023-*` — живий доказ потреби в арбітрі (US-5).
4. **`.claude/commands/sdd/` містить 9 команд**, не 5 задокументованих (`+clarify, research, audit, verify`) — документація відстає від коду.
5. **Подвійне дерево скілів** `.agents/skills/` vs `.claude/skills/` — закрито в `clarify.md` п.4 (`.agents/skills/` канон).
6. **Коміти фізично на dev-184** (не Termux — уточнено користувачем, Termux-контур зараз неактуальний). `bin/build-deploy.sh` не містить git-операцій.

---

## 1. Конституція §3: two-layer модель (Варіант C, `clarify.md` п.1)

### 1.1 Дії

1. Preflight-бекап: `cp .specify/constitution.md .specify/constitution.md.pre-install-backup` (локально на dev-184, поза git).
2. `specify integration install claude` → перевірити `git diff --stat .specify/constitution.md`; якщо зачеплено — `git checkout -- .specify/constitution.md`, відновити з backup.
3. `specify integration install codex --integration-options="--skills"` (спершу `specify integration info codex` — перевірити реальний список опцій на цій версії CLI, дослідницький рядок з issue #1924 непідтверджений).
4. **НЕ встановлювати `agy`.**
5. Оновити конституцію до **1.1.0**, §3 → таблиця мапінгу:

   | Фаза SDD | Native primitive | Project command | Shared skill |
   |---|---|---|---|
   | Specify | `/speckit.specify` | `/sdd:feature` | `.agents/skills/sdd-feature` |
   | Clarify | — | `/sdd:clarify` | `.agents/skills/speckit-clarify` |
   | Plan | `/speckit.plan` | (у складі шаблонів) | `.agents/skills/speckit-plan` |
   | Tasks | `/speckit.tasks` | (у складі шаблонів) | `.agents/skills/speckit-plan` |
   | Implement | `/speckit.implement` | `/sdd:{bugfix,refactor,integration,teaching}` | `.agents/skills/sdd-*` |
   | Verify | — | `/sdd:verify` | `bin/sdd_verify.sh` |

6. Правило пріоритету в §3: конституція = інваріанти, методологія = процедура, native-команди = транспорт. За конфліктом виграє конституція.

### 1.2 Де тестувати (`clarify.md` п.2)

Прямо на `astryx-ui-refactor` (live). Мітигація: backup + git-diff-перевірка після кожного install-кроку + `curl 127.0.0.1:5005/ops` до/після (прод не залежить від `.specify/`/`.claude/`, але перевіряємо емпірично, не припускаємо).

---

## 2. Codex CLI: гібрид, скіли + тонкі лаунчери

### 2.1 Рішення

Логіка — в `.agents/skills/`, `.codex/prompts/` — тонкі лаунчери. Обґрунтування:
- Codex підтримує `$1..$9`/`$ARGUMENTS`/`$$`; наявні `.claude/commands/sdd/*.md` уже покладаються на `$ARGUMENTS` — prompt-файл дає ту саму ергономіку.
- Prompt-файли реєструються в TUI-меню (discoverability), скіли — семантично.
- Нуль дублювання: процедурна логіка лишається в скілі, який читають і AGY, і Codex.
- Ні `.codex/prompts/`, ні непорожній `~/.codex/skills/` не підтверджені живими на dev-184 (`codex-cli 0.124.0`) → гібрид хеджує обидва механізми.

### 2.2 Файли

Спільні скіли (джерело правди, 5 шт.):
```
.agents/skills/sdd-feature/SKILL.md
.agents/skills/sdd-bugfix/SKILL.md
.agents/skills/sdd-refactor/SKILL.md
.agents/skills/sdd-integration/SKILL.md
.agents/skills/sdd-teaching/SKILL.md
```
Кожен: frontmatter `name`/`description` (стиль наявних `speckit-*`), тіло 4-6 кроків з посиланнями (не копіями): `.specify/constitution.md` → методологія (ШАБЛОН N) → `impact()` → `specs/<NNN-slug>/{spec,plan,tasks}.md` → `bash bin/sdd_verify.sh`.

Тонкі Codex-лаунчери (5 шт.):
```
.codex/prompts/sdd-feature.md
.codex/prompts/sdd-bugfix.md
.codex/prompts/sdd-refactor.md
.codex/prompts/sdd-integration.md
.codex/prompts/sdd-teaching.md
```
Шаблон тіла:
```
Ціль: $ARGUMENTS
1. Прочитай .agents/skills/sdd-feature/SKILL.md і виконай його буквально.
2. Інваріанти: .specify/constitution.md. MUST-правила: AGENTS.md.
3. Номер specs/ визначай через `ls specs/` — не з пам'яті.
4. Фінальний звіт: створені файли, impact-аналіз, pytest, bash bin/sdd_verify.sh.
```

Додатково: перевірити `trust_level` для проєкту в `~/.codex/config.toml` (репо не зареєстроване напряму, є батьківський `/home/vokov/projects` — перевірити емпірично чи наслідується).

### 2.3 Поза межами фази 1

4 додаткові команди (`clarify/research/audit/verify`) — дельта-задача після підтвердження базового механізму на 5 канонічних.

---

## 3. AGY-інтеграція

### 3.1 `sdd-workflow/SKILL.md` — без змін
Сумісний з Progressive Disclosure як є.

### 3.2 5 окремих skill-файлів потрібні
Progressive Disclosure тримає в контексті AGY лише `name`+`description` на старті сесії. Один загальний `sdd-workflow` не дає маршрутизаційного сигналу між bugfix/refactor. 5 `description`-полів = 5 тригерів. Ті самі файли з §2.2 обслуговують AGY і Codex одночасно.

### 3.3 Правки документації

**`docs/for-agents/prompts/README-sdd-commands.md`** — секцію «Щодо agy» замінити:
- `.agent/commands/` з `$ARGUMENTS` — офіційно deprecated (AGY v1.20.5+).
- Єдиний сучасний механізм — `.agents/skills/<name>/SKILL.md` → авто-реєстрація `/<skill-name>`.
- Механічної підстановки змінних немає, параметри парсить модель.
- Оновити список команд Claude Code з 5 до реальних 9.
- Нова секція «Codex CLI» — `.codex/prompts/` + `$1..$9`/`$ARGUMENTS`/`$$`.

**`docs/for-agents/sdd-development-methodology.md`** §5/§6: оновити каталог скілів (реальний перелік, не 7), §6.1 (9 команд), §6.2 Agy (підтверджені факти), новий §6.4 Codex CLI.

### 3.4 Верифікація — не на dev-184
`agy` відсутній на dev-184. Acceptance-тест «`/sdd-feature` видно в TUI» — на пристроях AGY після синку гілки. Залежність між фазами, не блокер.

---

## 4. Handoff Protocol — `.specify/feature.json`

### 4.1 Наявний стан
Немає машинно-читного вказівника. `HANDOFF.md` — прозовий, застарілий (~3 тижні), описує іншу гілку/файли.

### 4.2 Формат

```json
{
  "schema_version": 1,
  "feature_id": "021-multiagent-sdd-extension",
  "spec_dir": "specs/021-multiagent-sdd-extension",
  "branch": "astryx-ui-refactor",
  "phase": "plan",
  "phases_done": ["specify", "clarify"],
  "owner_agent": "claude-code",
  "host": "dev-184",
  "updated_at": "2026-08-17T09:00:00Z",
  "notes": "стисло, 1 рядок"
}
```
- `branch` обов'язковий — захищає від міжгілкової плутанини нумерації.
- `phase` ∈ `specify|clarify|plan|tasks|implement|verify`.
- Статуси задач лишаються в `tasks.md` (чекбокси `- [x]` + докази).

### 4.3 Обов'язки агента (`AGENTS.md` → «Always Do»)
1. Перед першим записом — прочитати `feature.json` + `git log -n 1 --stat`.
2. Якщо `branch` у файлі ≠ поточна гілка → STOP, повідомити оператора.
3. На кожному фазовому переході — оновити поля + окремий атомарний коміт (`spec:`, `plan:`, `tasks:`, `impl:`).
4. `feature.json` — трекований git-ом.

### 4.4 Ризик
Конкурентна робота кількох агентів → race на `feature.json`. Фаза 1: advisory-правило, не файловий лок.

---

## 5. LLM Arbiter

### 5.1 Розміщення
Коміти — на dev-184 (уточнено користувачем, Termux-контур неактуальний). `.git/hooks/pre-commit` не трекується git-ом → `core.hooksPath=.githooks`, трекований `.githooks/pre-commit` (закрито `clarify.md` п.6).

### 5.2 Інваріанти та безпека прода
- Hot path <5ms НЕ застосовується — офлайн git-операція.
- Прод не торкається: хук не читає SQLite, не рестартує сервер/watchdog, не тримає CDP-з'єднань. Єдиний зовнішній I/O — HTTP POST на `192.168.3.184:18880`.
- Інваріант 1 (PII): ключ лише в `~/.vydra-survey-profiles/sdd_judge.env` (закрито `clarify.md` п.5). Pathspec-фільтр diff (`:!specs/ :!*.txt :!credentials.json :!*.db`) + pre-flight PII-regex-скан.
- Інваріант 5: хук локальний, обходиться `--no-verify` — не є гейтом Інваріанта 5. Реальний гейт (якщо буде відновлено push-контроль) — окремий крок у `bin/sdd_verify.sh --arbiter`.

### 5.3 Fail-open
- Проксі недосяжний / таймаут (15s) / невалідний JSON → WARN + `exit 0`.
- `verdict: FAIL` → `exit 1` + violations.
- Немає `feature.json`/`spec.md` → `exit 0`.
- `SDD_JUDGE_DISABLE=1` → `exit 0` (escape hatch).

### 5.4 Правки скрипта з дослідження
1. `401`-обробка: `Authorization: Bearer $SDD_JUDGE_KEY` з env, WARN+skip при auth-помилці.
2. `SDD_JUDGE_MODEL` конфігурований, не хардкод `gpt-4o-mini`.
3. Fallback на regex-екстракцію JSON, якщо `response_format: json_object` не підтримується проксі.
4. Логувати вердикти в `logs/sdd_judge/<ts>.json` (gitignored).
5. Читати `phase` з `feature.json` — на `phase != implement` очікувати diff лише в `specs/`.

---

## 6. `bin/sdd_verify.sh` — обов'язковий рефакторинг

Поточний: статичний allowlist 32 шляхів, впаде на `master` (нема `020`, немає `017`/`018` перевірки).

Три режими:
- **default** — динамічний обхід `specs/*/`, вимагати `spec.md` завжди, `plan.md`/`tasks.md` умовно (щоб не ретро-ламати `002..019`).
- **`--gate`** — читає `feature.json`, валідує лише активну фічу (артефакти для поточної `phase`, `branch` == поточна гілка).
- **`--arbiter`** — додатково `python3 scripts/sdd_llm_judge.py --staged`.
- `bin/ui_verify.sh` — лишити тільки в default-режимі.

---

## 7. Фази впровадження

| Фаза | Зміст | Залежить від | Ризик |
|---|---|---|---|
| P0. Clarify | ✅ виконано — `clarify.md` | — | LOW |
| P1. Spec | ✅ виконано — `spec.md` | P0 | LOW |
| P2. Shared skills | 5× `.agents/skills/sdd-*/SKILL.md` | P1 | LOW |
| P3. Codex prompts | 5× `.codex/prompts/sdd-*.md` + trust config + TUI smoke-тест | P2 | MEDIUM |
| P4. Docs | `README-sdd-commands.md` + методологія §5/§6 | P2, P3 | LOW |
| P5. Native Spec Kit | backup → `install claude` → `install codex` → конституція 1.1.0 | P4 | HIGH |
| P6. Handoff enforcement | `feature.json` правила в `AGENTS.md`, dogfooding на цій фічі | P1, P5 | MEDIUM |
| P7. sdd_verify рефакторинг | динамічний обхід + `--gate` + `--arbiter` | P6 | MEDIUM |
| P8. Arbiter | `sdd_llm_judge.py`, `.githooks/pre-commit`, shadow-режим тиждень | P1, P7 | MEDIUM-HIGH |
| P9. AGY-верифікація | sync гілки → `/sdd-feature` в TUI на AGY/AGY2/AGY3 | P2, P4 | LOW |

Критичний шлях: P0→P1→P2→{P3,P4}→P5→P6→P7→P8. P9 — паралельно після P4.

### 7.1 Крос-фазові ризики
- R1 (закрито): `.agents/skills/` канон, без дублювання.
- R2: гілко-залежна нумерація — знімається P7 (динамічний обхід).
- R3: живий прод на 5005 — жодна фаза не чіпає `astryx_survey_server.py`/`rules_api.py`/`web/src/`/БД.
- R4: наявний drift "023" — окрема майбутня задача `/sdd:audit` після P8.
- R5: нестабільність LLM-проксі — fail-open (§5.3).

---

## 8. Acceptance-критерії

1. `specify integration status` → `claude, codex` встановлені, `constitution.md` не змінений install-ом.
2. Codex: `/sdd-feature` присутня в TUI dev-184.
3. AGY (телефон/AGY2/AGY3): `/sdd-feature`…`/sdd-teaching` присутні.
4. `.specify/feature.json` валідний, `branch` == поточна.
5. `bash bin/sdd_verify.sh` → PASS на `master` і `astryx-ui-refactor`.
6. `bash bin/sdd_verify.sh --gate` → FAIL при штучно видаленому `plan.md` активної фічі.
7. `scripts/sdd_llm_judge.py`: FAIL на суперечливий diff; `exit 0`+WARN при недосяжному хості; `exit 0` при `SDD_JUDGE_DISABLE=1`.
8. `grep -c "не маю підтверджених даних" README-sdd-commands.md` → `0`.
9. Прод: `curl 127.0.0.1:5005/ops` → `200` до і після всіх фаз, `watchdog_astryx.sh` без рестартів.
10. `tests/unit/test_sdd_judge.py` — behavioral (мок HTTP), не тавтологічний.

---

### Критичні файли
- `.specify/constitution.md` (§3, версія → 1.1.0)
- `docs/for-agents/sdd-development-methodology.md` (§5, §6.1, §6.2, новий §6.4)
- `bin/sdd_verify.sh` (динамічний обхід + `--gate` + `--arbiter`)
- `AGENTS.md` (Handoff Protocol у «Always Do»)
- `docs/for-agents/prompts/README-sdd-commands.md`
- `/home/vokov/projects/Research/Multi-Agent SDD Workflow Extension.txt` (база для `scripts/sdd_llm_judge.py`)
