# Claude Audit — 021B Live Fixes (незалежний аудит Q)

**Гілка**: `astryx-ui-refactor` · **Дата**: 2026-08-15 · Дві знахідки з live-аудиту Q (не мого звіту), обидві виправлені й доведені.

## Знахідка 1 — `GET /api/rules/conflicts/count` відсутній на бекенді

**Команда**:
```
curl -b <cookie> -s https://survey.exodus.pp.ua/api/rules/conflicts/count | head -c 80
```
**Вивід ДО фіксу**:
```
content-type: text/html; charset=utf-8
content-disposition: inline; filename=index.html
```
Route не існував — Flask SPA-catch-all віддавав `index.html` з кодом 200 (не 404).

**Root cause в `apiFetch` (`web/src/api/client.ts`)**: перевіряв лише `response.ok`, не
content-type. Отримавши 200+HTML замість JSON, фолбечив на `response.text()`, повертаючи
HTML-рядок як типізовані дані `T`. Nav.tsx (`conflicts?.count ?? 0`) на рядку-не-об'єкті
мовчки давав `undefined ?? 0` → бейдж просто не показувався, замість сигналізувати помилку.

**FIX**:
1. `rules_api.py`: новий `GET /api/rules/conflicts/count` → `{"count": N}` (легка COUNT-версія
   вже наявного `/api/rules/conflicts`, той самий SQL-паттерн).
2. `web/src/api/client.ts` (`apiFetch`, спільна точка — уже проходять через неї
   `useResource`/`usePolling`/`TelegramQueueCard`/`ResumeTabCard`): якщо `/api/` endpoint,
   `response.ok`, але `content-type` містить `text/html` → кидає `ApiError` замість
   мовчазного `response.text()`.
3. `web/src/shell/Nav.tsx`: `usePolling` тепер читає `error`; при помилці бейдж = `⚠ ?`
   (variant `warning`), а не мовчання/0.
4. `web/src/ops/useTutorRelay.ts`: мігровано з сирого `fetch()` на `apiFetch` (той самий
   спільний хелпер) — єдиний інший виклик, знайдений через
   `rg -n "fetch\(.*api" web/src -g "*.ts" -g "*.tsx" | grep -v apiFetch` (другий кандидат,
   `LockButton.tsx` logout POST, навмисно НЕ мігровано — fire-and-forget, парсинг відповіді
   не потрібен, зміна ризикує зламати reload-on-401 логіку).

**Вивід ПІСЛЯ фіксу**:
```
$ curl -b <cookie> -s https://survey.exodus.pp.ua/api/rules/conflicts/count -D -
HTTP/2 200
content-type: application/json
x-content-type-options: nosniff
{"count":0}
```

**STATUS: PASS**

---

## Знахідка 2 — `/api/survey/telegram_queue` живий, але `last_update_at=null`, `items=[]`

### Крок 2.1 — чому чергу ніколи не наповнювало (негативний, але реальний результат)

Спроба: надіслати повідомлення в моніторований чат **самим ботом** (`sendMessage` через
Bot API, chat_id `-4964233423`, group "Завдання на опитування"):
```
curl "https://api.telegram.org/bot<TOKEN>/sendMessage" -d "chat_id=-4964233423" -d "text=..."
-> {"ok":true,"result":{"message_id":16,...}}
```
Перевірка `GET /api/survey/telegram_queue` після:
```
{"items":[],"listener":{"last_error":null,"last_update_at":null,"status":"active"}}
```
**Висновок**: Telegram НЕ повертає боту через `getUpdates` його ж власні надіслані
повідомлення в групі (документована поведінка Bot API). Якщо n8n постить у групу тим самим
токеном бота — черга дійсно ніколи не наповниться. Реальний, відтворюваний E2E-результат,
не гіпотеза.

### Крок 2.2 — реальний вхідний шлях: `/api/survey/telegram_push` (webhook-style, вже в проді)

Той самий `record_telegram_push()`, яким користується і `telegram_listener_thread` —
webhook-injection endpoint (whitelisted без auth, саме для таких зовнішніх джерел як n8n).

**Команда** (симуляція реального Telegram Update-об'єкта з update_id):
```
curl -X POST https://survey.exodus.pp.ua/api/survey/telegram_push \
  -H 'Content-Type: application/json' \
  -d '{"update_id": 900790536, "message": {"message_id": 17,
       "chat": {"id": -4964233423},
       "text": "Нове опитування: https://meinungsplatz.ch/e2e-webhook-test-1786790536"}}'
```
**Вивід**:
```
{"item":{"received_at":"2026-08-15T13:42:17...","state":"pending","update_id":900790536,
 "url":"https://meinungsplatz.ch/e2e-webhook-test-1786790536",...},"status":"success",...}
```
`GET /api/survey/telegram_queue`:
```
{"items":[{"received_at":"2026-08-15T13:42:17.688598","state":"pending",
  "update_id":900790536,"url":"https://meinungsplatz.ch/e2e-webhook-test-1786790536"}],
 "listener":{"last_error":null,"last_update_at":"2026-08-15T13:42:17.688598","status":"active"}}
```
**last_update_at живий, item з'явився. PASS.**

### Крок 2.3 — дедуплікація повторного update_id

**Команда**: той самий POST з тим самим `update_id: 900790536` вдруге.
**Вивід**: `items count: 1` (не 2), `received_at` не змінився (повернуто той самий item,
не додано новий):
```
items count: 1
[{"received_at": "2026-08-15T13:42:17.688598", "state": "pending", "update_id": 900790536, ...}]
```
**STATUS: PASS**

Побічна знахідка (не питали, але виявив): `push_task_from_text()` у тому ж хендлері
дедуп НЕ має — повторний update_id створює ДРУГИЙ окремий `task_id` (двічі), хоча
queue-item коректно один. Не входить у скоуп цього фіксу, задокументовано нижче
в "Не виправлено".

### Крок 2.4 — «Забрати» (Claim) → attach до існуючої вкладки, не новий прогін

**Знайдено реальний БАГ під час перевірки** (я його пропустив у попередньому diff-рев'ю
AGY-коду): `claim_telegram_queue_api()` викликав
`run_survey_execution(profile, url)` — **без** `resume_tab_url`. Тобто Claim
**завжди** стартував новий прогін, ніколи не робив attach до існуючої вкладки —
пряме порушення вимоги Гейту 7c.

**FIX**: `astryx_survey_server.py::claim_telegram_queue_api` —
`run_survey_execution(profile, url)` → `run_survey_execution(profile, url, url)`
(URL з Telegram-повідомлення передається і як ціль, і як anchor для
`cdp_client.attach_exact_tab()`). Безпечно: підтверджено кодом `survey_agent.py`
(`is_existing = client.attach_exact_tab(...)`) — якщо збігу немає, `is_active_survey`
падає в `False` і код грейсфулно фолбечить на звичайний фреш-старт, не падає.

**Доказ (dry-run reconstruction точного cmd, який будує `run_survey_execution`)**:
```
python3 -c "... cmd = ['bash', '~/llm-switch.sh', 'survey', profile, url, '-f']
             if resume_tab_url: cmd += ['--resume-tab', resume_tab_url] ..."
-> ['bash', '/home/vokov/llm-switch.sh', 'survey', 'arno',
    'https://meinungsplatz.ch/e2e-claim-test-X', '-f',
    '--resume-tab', 'https://meinungsplatz.ch/e2e-claim-test-X']
```
`--resume-tab` підтверджено присутній у резолвленій команді.

**Живий Claim-виклик** (`POST /api/survey/telegram_queue/901791089/claim`):
```
{"profile":"arno","status":"success","url":"https://meinungsplatz.ch/e2e-claim-test-1786791089"}
```
Лог сервера:
```
[13:51:43] ⚡ Завдання з Telegram #901791089 взято в роботу для Арсен (...)
[13:51:43] 🚀 Ексклюзивний запуск Gemma 3 4B Survey Agent for arno...
[13:51:43] bash: /home/vokov/llm-switch.sh: No such file or directory
[13:51:43] ❌ Завершено з помилкою (код 127).
```

**ЧЕСНЕ ОБМЕЖЕННЯ (не приховую)**: `~/llm-switch.sh` **фізично відсутній на dev-184**
(`find / -iname llm-switch.sh` → 0 результатів; документований у `README.md`/`HANDOFF.md`
як частина архітектури, але виконання survey-агента відбувається на іншому хості —
Termux/телефон, за архітектурою Vydra). Тому:
- **PASS**: код-рівень — `resume_tab_url` тепер коректно передається з Claim, доведено і
  прямим dry-run-відтворенням cmd, і живим викликом (запуск дійшов до спроби exec).
- **НЕ ДОВЕДЕНО**: фізичний CDP-attach до реального відкритого вікна браузера — на dev-184
  немає компонента, що виконує `cdp_client.attach_exact_tab()` (він живе всередині
  `survey_agent.py`, який запускає відсутній `llm-switch.sh`). Потребує окремого тесту на
  хості, де ця частина реально розгорнута (телефон/AGY3 Termux) — поза скоупом цієї сесії.

**STATUS: PASS (код-рівень, доведено), NOT PROVEN (фізичний attach — env gap, не мій фікс)**

---

## Скріншоти (live, чек-суми)

| Файл | SHA256 |
|---|---|
| `evidence/021B-fixes/01-queue-pending.png` (item у черзі, `pending`, свіжий `last_update_at`) | `27d48a80c1d948e079fd398abaf91c1420390696b45fba2bd8f3021744624809` |
| `evidence/021B-fixes/02-queue-after-claim.png` (той самий item зник з pending-списку після Claim) | `9967e3c22b0af0eaeff323edf09b3eb6f9da1b8cb9e5953db48717760e127235` |

## Фінальний прогін (усі exit 0)

```
bin/ui_verify.sh                                  -> EXIT=0
bin/deploy_verify.sh https://survey.exodus.pp.ua  -> EXIT=0
bin/ops_verify.sh https://survey.exodus.pp.ua     -> EXIT=0
```
Повний вивід: `deploy_verify.log` (корінь репо).

**Перевірка "не приймати зелено без свіжого last_update_at"**:
```
GET /api/survey/telegram_queue (після фінального прогону) ->
"listener":{"last_error":null,"last_update_at":"2026-08-15T13:53:07.222602","status":"active"}
```
Свіжий (з мого тестового push цієї сесії), не null.

## Не виправлено (поза скоупом двох заданих знахідок)

- `push_task_from_text()` не дедуплікує по `update_id` (на відміну від `record_telegram_push`)
  — повторний update_id створює 2 окремі survey-tasks. Знайдено побічно при тесті дедупу.
- Фізичний CDP-attach через Claim не доведений на dev-184 — `~/llm-switch.sh` відсутній
  (env gap, окремий хост за архітектурою Vydra).
- Якщо n8n реально постить через **Bot API sendMessage тим самим токеном** (а не через
  `/api/survey/telegram_push` webhook) — черга НІКОЛИ не наповниться (підтверджено Кроком 2.1).
  Потребує перевірки самого n8n workflow (`завдання на опитування з ШІ`, id `c4gZHN2sl3UMvkTs`,
  `active: false`, `availableInMCP: false` — не зміг інспектувати деталі через MCP).

## Файли змінено

`rules_api.py`, `web/src/api/client.ts`, `web/src/shell/Nav.tsx`, `web/src/ops/useTutorRelay.ts`,
`astryx_survey_server.py` (claim resume-attach fix).
