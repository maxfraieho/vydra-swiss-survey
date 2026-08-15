# Claude Audit — 020C / 021B (Astryx UI Refactor)

**Гілка**: `astryx-ui-refactor` · **Дата**: 2026-08-15 (оновлено після делегування AGY .234) · **Виконавець**: Claude (аудит, не AGY-звіт)
**Методика**: /ssd. RULE #0: PASS лише з runtime-доказом (живий URL/CDP/файл evidence). Немає файлу — FAIL.
**021B docs**: `claude-inline-prompt-020C-021B.md` / `agy-prompt-021B-telegram-and-resume.md` **не потрапили в гілку**
до кінця 2-хв вікна очікування (Q поклав вручну, файли не з'явились) — Гейти 0-6 виконано за наявним
`agy-prompt-020C-deploy-truth.md`, Гейт 7 — за inline-описом від Q у цій сесії.

## Зведення

| Гейт | Команда | PASS/FAIL | Що виправлено |
|---|---|---|---|
| 0 — live 200 + автостарт | `curl -sI https://survey.exodus.pp.ua/` | **PASS** (після фіксу) | Два cloudflared-конектори на 1 tunnel ID; OrangePi-конектор мав stale IP `192.168.3.196` (телефон Q) для `survey.exodus.pp.ua`. Виправлено на `192.168.3.184` в `/etc/cloudflared/config.yml` (sudo, підтверджено Q), конектор перезапущено (новий PID, автостарт підтверджено) |
| 1 — wiring Viewport/view=fullscreen/reason_code | `rg -n "useViewportMode\|view=fullscreen\|reason_code" web/src` | **PASS** | — (вже коректно підключено: `main.tsx` 5 routes, `SurveyOps.tsx` рендерить `Viewport`) |
| 2 — `bin/ui_verify.sh` | `bash bin/ui_verify.sh` | **PASS** | — (0 HEX, 0 sub-12px fontSize, всі файли ≤250 рядків; порогові значення скрипта перевірені вручну — не послаблені) |
| 3 — токени в живому бандлі (`bin/deploy_verify.sh`) | `bash bin/deploy_verify.sh https://survey.exodus.pp.ua` | **PASS** (після фіксу) | Відсутній npm-модуль `ws` → `bin/dom_probe.mjs` падав на старті (`MODULE_NOT_FOUND`). `npm install ws` в корені репо. Після фіксу: navCount=5, fullscreenDiff=true, 0 horizontal overflow на 390px (5/5 маршрутів), gate redirect OK, 0 pageErrors, 4 унікальні sha256 скріншоти |
| 4 — функціональний аудит усіх табів | live CDP click-through `/ops /rules /traces /report /settings` (окремий скрипт, ad-hoc, не закомічений) | **PASS** | — (0 pageErrors і 0 error boundary на всіх 5 табах; 51 checkbox на `/traces` підтверджує live compare-selector; source-level підтверджено D2/D3/C5/B6 з AGY test-plan.md — не довірено сліпо, перевірено кожен) |
| 5 — закриття публічного доступу | `curl` без/з `astryx_k` cookie на `/api/*` та `/` | **PASS**, з фіндингом | API 401 без cookie; `/` без cookie — окрема login-gate сторінка (title "Вхід"), не SPA. **FINDING**: секрет `astryx_k` захардкоджений у 4 git-файлах (`auth.py:24` fallback, `bin/deploy_verify.sh`, `bin/dom_probe.mjs`, `tests/regression/test_web_interface_routing.py`) — те саме значення, що в `~/.vydra-survey-profiles/astryx_api_token.secret`. Репо приватне → не критично, але порушує секрет-гігієну. Дій не виконано (поза скоупом фіксу) |
| 6 — evidence checksums | `sha256sum` усіх PNG у `evidence/020C` + `evidence/020C-021B` | **PASS** | 1 очікуваний дублікат (два незалежні live-проби `/ops` inline в один момент — той самий стан сторінки, не фабрикація). Основні 4 viewport-скріншоти (030-033) унікальні, як вимагається |
| 7a — git-археологія регресії | `git log -S "Telegram" --oneline -- web/src`; `git log --all -S "Continue in existing" --oneline` | **PASS** | Знайдено: `a73381b` (020 tabs restructure) видалив "Черга опитувань з Telegram" з `TelegramSettingsPanel.tsx`; `3be7aa1` додав resume-in-tab (backend + `SurveyOps.tsx` панель) — панель знесена тим самим `a73381b` |
| 7b — Telegram queue (listener/dedup/Claim/Discard) | `bash bin/ops_verify.sh https://survey.exodus.pp.ua` (bundle:telegram-queue), live `GET /api/survey/telegram_queue` | **PASS** (делеговано AGY .234, коміт `b49be60`, рев'ю дифу + live-перевірка Claude) | Реалізовано: `TELEGRAM_LISTENER_STATE` (status/last_update_at/last_error), `record_telegram_push()` дедуп по `update_id` ТА по URL (thread-safe, `STATE_LOCK`), `GET /api/survey/telegram_queue`, `POST .../claim`, `POST .../discard`. Frontend `web/src/ops/TelegramQueueCard.tsx` (`data-testid="telegram-queue"`), вбудовано в `SurveyOps.tsx` |
| 7c — Resume-from-URL (CDP attach existing tab) | `bash bin/ops_verify.sh` (bundle:resume-attach), diff-рев'ю `web/src/ops/ResumeTabCard.tsx` | **PASS** (делеговано AGY .234, коміт `b49be60`) | Frontend `ResumeTabCard.tsx` (`data-testid="resume-attach"`) підключено до вже наявного `POST /api/survey/resume_tab` (сумісність збережена: приймає і `resume_tab_url`, і старий `tab_url`). Auth-whitelist не зачеплено — нові ендпоінти лишились під cookie-гейтом (перевірено окремо) |
| 7d — секрети Telegram (env/секрет-стор, не в репо) | `sed -n '52,62p' astryx_survey_server.py` | **FAIL (CRITICAL)** | **Не виправлено за рішенням Q** ("лише задокументуй, без дій — я сам вирішу ротацію"). `get_telegram_bot_token()` містить `default_token = "8861125591:AAFUAdGZr_r3yq39msEBKaHorSmbJK4zT-s"` — це РЕАЛЬНИЙ Telegram Bot API токен, захардкоджений у git-трекнутому `astryx_survey_server.py`. env/DB-setting використовуються, ЯКЩО задані — але fallback-значення саме по собі є leak |
| 7e — `bin/ops_verify.sh` (gate script) | `bash bin/ops_verify.sh https://survey.exodus.pp.ua` | **PASS** | Скрипт не існував — створено (`bin/ops_verify.sh`). Перевіряє токени `telegram-queue`/`resume-attach` в live-бандлі + auth-гейт (`/api/survey/status` без cookie → 401, `/` без cookie → login-gate). Чесно падає (exit 1), бо 7b/7c не реалізовано — не послаблено під зелений результат |

## Поза скоупом Гейтів 0-7 (за проактивним запитом Q під час сесії)

| Перевірка | Результат |
|---|---|
| Synapse Memory OS (`synapse_adapter.py`, `SYNAPSE_API_URL=http://127.0.0.1:8787`) | **FAIL** — порт не слухає, процес відсутній. `scripts/start_synapse_api.sh` написаний під Termux-shebang, очікує `~/synapse/apps/api` — директорії немає на dev-184 взагалі. Ніколи не розгортався тут (окремий сервіс для Vydra/телефон, не портований). Потребує окремого розгортання |

## CRITICAL — auth-bypass через дублювання cloudflared-конекторів (знайдено ПІД ЧАС верифікації 021B, виправлено)

Після деплою Telegram Queue + Resume-in-tab, повторний прогін `bin/ops_verify.sh` показав
`/api/survey/status` без cookie → **200** замість 401 (auth повністю обходився), `/` без cookie
показувала консоль замість login-gate "Вхід". Підтверджено НЕ кешем (`cf-cache-status: DYNAMIC`,
відтворено 3x, і напряму на origin `127.0.0.1:5005`).

**Причина**: `auth.py::is_authed()` містить pre-existing backdoor
`if req.remote_addr in ("127.0.0.1", "::1"): return True` ("Auto-authorize local loopback
requests from Termux"). Мій же фікс Гейту 0 звів обидва cloudflared-конектори (dev-184 +
OrangePi, один tunnel ID) до порту 5005, але dev-184 йшов через `service: http://localhost:5005`
→ Flask бачив `remote_addr=127.0.0.1` → бекдор спрацьовував для ~50% зовнішнього трафіку
(Cloudflare балансує між конекторами одного tunnel ID по запиту).

**FIX** (варіант 2, підтверджено Q — розірвати дублювання, не чіпати `auth.py`):
`/home/vokov/.cloudflared/config.yml` (dev-184): `http://localhost:5005` →
`http://192.168.3.184:5005` (той самий LAN IP, що вже на OrangePi). Обидва конектори тепер
ідентичні для `survey.exodus.pp.ua` — жоден не тригерить loopback-bypass.

Побічний інцидент під час фіксу: `pkill -f` self-match вбив власну SSH-сесію (текст патерну
збігся з текстом наступної `nohup`-команди в тому ж виклику) — dev-184-конектор коротко впав,
відновлено вручну. `gitnexus`/`notebooklm`/`opendesign` (502) виявились непричетні —
`connection refused` на origin-сервісах, не на самому тунелі. `docs-agent`/`claude-proxy` (404) —
без baseline "до", не досліджено далі, поза скоупом.

**Verification**: 20x `curl .../api/survey/status` без cookie → 401 (20/20). З cookie → 200.
`/` без cookie → `<title>Вхід</title>`. Evidence:
`docs/astryx-refactor/evidence/020C-021B/07-critical-auth-bypass-fix.txt`.

## Definition of Done — фінальний стан

```
bin/ui_verify.sh                                  -> exit 0  (PASS)
bin/deploy_verify.sh https://survey.exodus.pp.ua  -> exit 0  (PASS)
bin/ops_verify.sh https://survey.exodus.pp.ua     -> exit 0  (PASS)
```

DoD — **виконано повністю**, включно з Гейтом 7 (021B). Telegram Queue + Resume-in-tab
реалізовано AGY (192.168.3.234, `agy --mode=accept-edits`), diff незалежно перевірено Claude
(backend thread-safety, auth-whitelist, frontend tokens), задеплоєно і живо перевірено з dev-184.

## Виправлення, застосовані цією сесією

1. `/etc/cloudflared/config.yml` (OrangePi, root): `192.168.3.196` → `192.168.3.184` для `survey.exodus.pp.ua` — усунуло 502.
2. `package.json` / `package-lock.json` / `node_modules/ws` (репо root): `npm install ws` — усунуло `MODULE_NOT_FOUND` у `bin/dom_probe.mjs`.
3. `bin/ops_verify.sh` — новий файл, Гейт 7e.
4. `.gitignore` — додано кореневий `node_modules/`.
5. Telegram Queue + Resume-in-tab UI (Гейт 7b/7c) — делеговано AGY .234, коміт `b49be60`.
6. `/home/vokov/.cloudflared/config.yml` (dev-184): `localhost:5005` → `192.168.3.184:5005` — закрило CRITICAL auth-bypass (вище).

## Критичні знахідки, що НЕ виправлялись (за явним рішенням Q)

- **CRITICAL**: живий Telegram Bot API токен захардкоджений в `astryx_survey_server.py` (`get_telegram_bot_token`, default fallback). Ротація — на розсуд Q.
- Секрет `astryx_k` (гейт-cookie на весь консольний доступ) захардкоджений у 4 файлах git.
- Synapse Memory OS не розгорнутий на dev-184.
- `docs-agent.exodus.pp.ua` / `claude-proxy.exodus.pp.ua` — 404 при перевірці, без baseline "до" цієї сесії, не досліджено.

## Evidence

`docs/astryx-refactor/evidence/020C/` — 00-wiring-gap, 10-bundle-tokens, 11-dom-probe, 20-21 verify logs, 30-33 screenshots + 40-checksums (попередній прогін AGY, незалежно перевірено цією сесією).
`docs/astryx-refactor/evidence/020C-021B/` — 00 (gate0 fix), 01 (synapse gap), 02 (gate1), 03 (gate2), 04 (gate5), 05 (gate7), 06 (checksums), 07 (critical auth-bypass fix), `gate4/` (5 live screenshots + JSON).
`deploy_verify.log` (корінь репо) — фінальний вивід `ui_verify.sh` + `deploy_verify.sh` + `ops_verify.sh`, усі exit 0.
