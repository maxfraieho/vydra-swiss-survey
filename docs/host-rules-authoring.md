# Як додавати host_rules (поведінку агента на конкретному сервісі опитування)

> Легкий гейд, НЕ повний DRAKON round-trip (той підхід свідомо відхилено для цього проєкту — див. `docs/plan-ui-astryx-addendum.md` §3: "адаптувати принципи, не round-trip"). Формат — просто поля в SQLite-рядку, тут показано як псевдокод/JSON для зручності планування перед записом.

## Що таке host_rule

Один рядок = одна інструкція: "на хості X, для персони Y, коли бачиш патерн Z — роби так". Приклад:

```json
{
  "host": "meinungsplatz.ch",
  "persona": "arno",
  "pattern": "tobacco",
  "behavior": "Відповідай 'так' на питання про куріння тютюну — Арно курить.",
  "source": "human_override",
  "status": "active",
  "confidence": 0.9
}
```

Це домішується в промпт персони через `get_enhanced_persona()` (`persona_graph_memory.py`) перед КОЖНИМ прогоном на цьому хості — Gemma бачить це як частину інструкції персони, не як окремий код.

## Поля (точна схема — `host_rules` в `persona_graph_memory.py`)

| Поле | Значення | Обов'язкове |
|---|---|---|
| `host` | домен сервісу (`meinungsplatz.ch`) або `*` для глобального правила на всі хости | так |
| `persona` | `arno` / `annet` / `*` (усі персони) | так, дефолт `*` |
| `pattern` | ключ зі словника нижче — НЕ довільний текст | так |
| `behavior` | інструкція укр. мовою, до 2000 символів, текст а не код (див. `pattern-vocabulary.md` §"Інваріант") | так |
| `source` | `human_override` (ти) / `self_reflection` (агент сам) / `seed` (базові дефолти з міграції) | заповнюється автоматично |
| `status` | `shadow` (записано, ще не впливає) / `active` (впливає на промпт) / `retired` (архів) | дефолт `shadow`, людські override — одразу `active` |
| `confidence` | 0.0-1.0, орієнтир на "наскільки довіряти" | дефолт 0.5 (human_override зазвичай 0.9) |

## Дозволений словник `pattern` (не вигадуй нові без потреби — `reflection.py::TOPIC_KEYWORDS`)

`tobacco`, `health_status`, `alcohol`, `auto`, `finance`, `income`, `employment`, `industry_exclusion`, `household`, `shopping`. Кожен має задану кваліфікуючу полярність (`QUALIFYING_POLARITY`) — наприклад `industry_exclusion` завжди `deny` (ніколи не визнавати роботу в market research). Якщо потрібен новий патерн — спочатку додай його в `TOPIC_KEYWORDS`/`QUALIFYING_POLARITY` в `reflection.py` (це стосується коду, не тільки правила).

## Три способи додати правило (за поточним станом коду, 2026-08-08)

### 1. Живий override під час опитування (зараз єдиний спосіб для не-розробника)
`/legacy` → Режим Навчання → коли агент про щось питає, натисни Override, введи ціль/пояснення. Якщо на цьому кроці детектився `pattern` — правило пишеться одразу `source=human_override, status=active, confidence=0.9` (`astryx_survey_server.py::override_step_api`). Якщо pattern не детектився — пише плаский факт `rule_<timestamp>` (не структуроване правило, не шукається повторно за host+pattern).

### 2. CLI напряму в базу (зараз єдиний спосіб поза живим прогоном)
```bash
python3 persona_graph_memory.py rules '*'          # переглянути всі активні правила
python3 -c "
from persona_graph_memory import record_host_rule
record_host_rule(
    host='meinungsplatz.ch', pattern='tobacco',
    behavior=\"Відповідай 'так' на питання про куріння — Арно курить.\",
    persona='arno', source='human_override', status='active', confidence=0.9,
)
"
```
Увага: `record_host_rule()` (не плутати з `update_host_rule()` з U3) при конфлікті на `(host,persona,pattern,source)` мовчки БАМПАЄ confidence існуючого рядка — не створює новий і не переписує behavior відкрито. Для точного редагування вже існуючого правила чекай на U3-UI (нижче) або редагуй SQLite напряму: `sqlite3 ~/.vydra-survey-profiles/survey_graph.db`.

### 3. HTTP API (`369e018`, live в проді з 2026-08-08)
```bash
curl -X POST https://survey.exodus.pp.ua/api/rules \
  -H "X-Astryx-Token: $ASTRYX_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"host":"meinungsplatz.ch","persona":"arno","pattern":"tobacco",
       "behavior":"Відповідай так на питання про куріння — Арно курить.",
       "confidence":0.9}'

curl -X PATCH https://survey.exodus.pp.ua/api/rules/17 \
  -H "X-Astryx-Token: $ASTRYX_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"retired","note":"застаріло, сайт змінив питання"}'
```
Без `ASTRYX_API_TOKEN` в env сервера — усі мутуючі маршрути відповідають 503 (вимкнено навмисно, а не забуто). UI-панель під цей API (щоб не писати curl вручну) — це U5, ще не зроблено.

## Псевдокод-шаблон для планування пачки правил наперед (не формат для машини — просто для тебе, перед тим як виконати CLI/API)

```
RULE meinungsplatz_tobacco
  HOST meinungsplatz.ch
  PERSONA arno
  PATTERN tobacco
  BEHAVIOR "так, курить"
  CONFIDENCE 0.9

RULE meinungsplatz_health
  HOST meinungsplatz.ch
  PERSONA arno
  PATTERN health_status
  BEHAVIOR "не повністю здоровий — легка астма"
  CONFIDENCE 0.9
```
Немає парсера під цей псевдокод (і не планується — на відміну від `vydra-studio`, де є DRAKON→`agent_rules.yaml`). Це просто зручний спосіб накидати список перед тим, як руками прогнати через спосіб 2 або 3.

## Конфлікти (той самий host+persona+pattern, різний source)

Пріоритет читання (`get_host_rules`): точний host > base_domain > `*`; `human_override` завжди перекриває `self_reflection`. Якщо два людські override конфліктують між собою (рідко) — `POST /api/rules/<id>/resolve_conflict` (U3, з U3) або вручну `retired` зайвий рядок через CLI/SQLite.

## Що НІКОЛИ не робити

- Не пиши `behavior` як код/JSON-логіку — тільки текст природною мовою (Gemma читає це як частину персони, не виконує).
- Не став `status=active` для self_reflection правил вручну без перевірки — вони мають лишатись `shadow`, доки не назбирають wins/losses (`bump_rule_outcome`) і не пройдуть auto-promote (лише при `VYDRA_PLAYBOOK=active` для цього хоста).
- Не редагуй `survey_graph.db` напряму на проді без бекапу — SQLite-файл, конкурентний доступ з живим прогоном (WAL-режим ще не увімкнено, це U4 — до того момента конкурентний запис ризикований).
