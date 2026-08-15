# SDD 021C — Viewport Zoom, Anti-bot HITL, CH Locale Fingerprints

**Гілка**: `astryx-ui-refactor` · Методика: /ssd (Spec-Driven Development, `.specify/constitution.md`)

## Problem

1. **Zoom** (`web/src/ops/Viewport.tsx:41,85,111`): ступінчастий toggle 100%/175%
   (`useState(1)`, hardcoded `scale > 1 ? '100%' : '175%'`) — немає плавного діапазону,
   немає якорної математики (zoom навколо курсора/пінча), немає fit-to-width/reset,
   немає desktop device emulation для малих екранів.
2. **Anti-bot + HITL**: `agent/behavior/human_profile.json` існує як конфіг (jitter,
   bezier, typing delay), але **жодного коду**, що його читає чи застосовує
   (`rg bezier *.py` → 0 збігів). Реальний CDP-рух миші/тайпінг — прямий, машинний.
   `waiting_verification` статус вже є (`astryx_survey_server.py:74`), але лише для
   "Режим Навчання" (крокова верифікація AI-дій людиною), не для bot-filter/challenge
   детекції. Потрібне перевикористання цієї інфраструктури + `reason_code` (вже є,
   `AttentionCard.tsx`) під новий сценарій `captcha_detected`, з кнопками
   Resume/Skip/Abort.
3. **CH locale**: `cdp_client.py:240` підмінює лише `navigator.languages`
   (`['de-CH','de','fr-CH','en-US']`). Немає `Intl.DateTimeFormat` timezone-override,
   немає CDP `Emulation.setTimezoneOverride`/`setLocaleOverride`, немає geo.

## Decision

- Zoom: React state `zoomPercent` (25–400, крок 1%) + `transformOrigin` обчислюваний
  динамічно з координат курсора/pinch-центру відносно контейнера (не статичний
  `top left`). Wheel (`onWheel` + `ctrlKey`/trackpad-pinch), touch pinch (2-touch
  distance delta), кнопки +/-, fit-to-width (обчислення `containerWidth/contentWidth`),
  reset → 100%. Desktop emulation — окремий перемикач, викликає
  `Emulation.setDeviceMetricsOverride({width:1280|1440, height:800|900, mobile:false})`
  через існуючий CDP-канал (`bin/dom_probe.mjs`-подібний, або новий ендпоінт
  `/api/survey/cdp_emulate` якщо прямого каналу з фронтенду нема — уточнити при
  імплементації, чи Viewport вже має CDP proxy).
- Anti-bot: новий модуль `human_behavior.py` (окремо від конфіга) — читає
  `agent/behavior/human_profile.json`, реалізує quadratic/cubic Bezier для мишевих
  рухів (керовані точки з overshoot per конфіг), typing delay з рівномірним
  розподілом 30-80мс + випадкові паузи. Виклики — з `survey_agent.py` замість
  прямих CDP `Input.dispatchMouseEvent`/`Input.insertText`.
- HITL challenge: детектор bot-filter (текстові/DOM маркери — cloudflare/hCaptcha/
  recaptcha, як вже частково згадано в test-plan.md AGY-звіті з минулої сесії, але
  БЕЗ коду під ним — верифікувати, не довіряти) → переводить
  `ACTIVE_SURVEY_STATE["status"]="waiting_verification"` +
  `reason_code="captcha_detected"`, UI (`AttentionCard`) рендерить блок з
  інструкцією + кнопками "Я вирішив / Resume" (`POST /api/survey/resume_after_captcha`
  — новий ендпоінт) і "Skip / Abort" (`POST /api/survey/abort_task` — перевірити,
  чи вже є аналог).
- CH fingerprints: розширити `cdp_client.py` init-script — `Emulation.setTimezoneOverride
  ("Europe/Zurich")`, `Emulation.setLocaleOverride("de-CH")` (CDP native, не лише
  JS navigator-патч), `Intl.DateTimeFormat.prototype.resolvedOptions` override для
  надійності на випадок, якщо CDP override недоступний у поточній версії Chrome.
  Гео — лише якщо проксі дозволяє (перевірити наявність Swiss-proxy конфіга,
  інакше задокументувати як N/A, не FAIL).

## Implementation (файли)

- `web/src/ops/Viewport.tsx`, `web/src/ops/useViewportMode.ts` — zoom range + anchor math.
- `web/src/ops/DesktopEmulationToggle.tsx` (новий) — перемикач 1280×800/1440×900.
- `human_behavior.py` (новий, корінь репо) — Bezier mouse + typing jitter, читає
  `agent/behavior/human_profile.json`.
- `survey_agent.py` — виклики `human_behavior` замість прямого CDP dispatch.
- `astryx_survey_server.py` — bot-filter детектор, `/api/survey/resume_after_captcha`,
  reason_code `captcha_detected`.
- `web/src/ops/AttentionCard.tsx` — challenge-блок з Resume/Skip/Abort.
- `cdp_client.py` — CH locale/timezone CDP-рівень.

## Verification Gates

| # | Назва | Команда | Очікуваний вивід | PASS умова |
|---|---|---|---|---|
| 0 | Live availability | `curl -I https://survey.exodus.pp.ua` | `HTTP/2 200` | live 200 |
| 1 | Zoom math | Puppeteer/CDP на `/ops`, set zoom 50/100/200/400% | `transform-origin` = точка курсора/центр, `scale` = введене ±1% | усі 4 точки в межах похибки |
| 2 | Desktop emulation | `Emulation.setDeviceMetricsOverride(1280,800)` або `(1440,900)` → скріншот | десктопний layout, без mobile breakpoint | скріншот без mobile-класів |
| 3 | CH fingerprints | на meinungsplatz.ch: `navigator.language`, `navigator.languages`, `Intl.DateTimeFormat().resolvedOptions().timeZone` | `de-CH`/`fr-CH`/`it-CH` + `Europe/Zurich` | точний збіг |
| 4 | Human typing | заміряти час введення 10 символів | середня затримка 30-80мс, std dev > 5мс | обидві умови |
| 5 | Mouse Bezier | записати координати `mousemove`, перевірити кривизну шляху | кривизна > 0 (не пряма лінія) | non-linear path |
| 6 | HITL challenge | симуляція challenge-детекції | `status=waiting_verification`, UI показує блок з Resume/Skip/Abort | live DOM-доказ |
| 7 | Regression | `bin/ops_verify.sh` | Telegram Queue + Resume-in-tab досі PASS | exit 0, токени присутні |
| 8 | Security | `curl /api/* без cookie` | 401; `rg -i "password\s*=\s*['\"]" *.py` | 401 + 0 plaintext-паролів у коді |
| 9 | UI invariants | `bash bin/ui_verify.sh` | 0 HEX, `style={{` ≤ 40 (існуючий поріг скрипта; user-вимога "≤17" — уточнити з Q чи затягувати поріг) | exit 0 |

**RULE**: жоден гейт не отримує PASS без runtime-доказу (команда+вивід в evidence).
Не писати "100% PASS" якщо хоч один FAIL — чесний FAIL + план виправлення.

## Виконавці

- **.184 (dev-server)**: координація, легкі аудити, деплой (`bin/build-deploy.sh`),
  `bin/ui_verify.sh`/`bin/deploy_verify.sh`/`bin/ops_verify.sh`, коміти.
- **AGY .234** (rpi3b, `agy --mode=accept-edits`): важка імплементація (Zoom math,
  Bezier/typing-код, CH CDP emulation, HITL wiring) + важкі E2E/Puppeteer-прогони.

## Відкриті питання (потребують рішення Q перед/під час імплементації)

1. Скрипт `bin/ui_verify.sh` наразі має поріг `style={{ <= 40`; задача каже `<= 17`.
   Затягувати поріг чи лишити 40 (нові Zoom/HITL-компоненти можуть додати
   `style={{` для transform/animation, які важко зробити через className)?
2. Swiss-proxy для гео (Gate 3 гео-частина) — чи є конфігурований проксі, чи
   позначити гео як N/A?
3. Bot-filter детектор (Cloudflare/hCaptcha/recaptcha markers) — попередній
   AGY test-plan.md (з минулої сесії, НЕ верифіковано) згадував це як вже готове;
   реально коду немає. Будувати з нуля.
