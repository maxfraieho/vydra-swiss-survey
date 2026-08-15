# Audit Report 023: Track B (UI Defects U1–U6)

## Track B: UI Defect Fixes & Verification

### Summary of Fixed Defects

| Defect ID | Description | Root Cause | Fix Applied | Verification Status |
|-----------|-------------|------------|-------------|---------------------|
| **U1** | Viewport zoom > 100% overflow pan scroll cut-off | `transform: scale(scale)` does not expand layout box dimensions; flexbox `flex-center` clipped edges | Migrated to CSS layout box scaling (`width: ${zoomPercent}%`, `minWidth: ${zoomPercent}%`) with conditional `overflow-auto` scrolling container. | **PASS** (Live CDP test at 270% zoom: `scrollWidth = 3386px`, `scrollLeft = 2132px`, full right/bottom edge reachable) |
| **U2** | Dead "✎ Виправити" button in Fullscreen / Focus mode | Button click was a silent no-op without UI form or payload generation | Integrated `ViewportCorrectionForm` inline in fullscreen/focus view. Dispatches structured `HumanCorrection` (`kind: 'override_click'`, `reason_code`, `override_value`, `note`) to `/api/survey/override`. | **PASS** (Live CDP & Vitest: Clicking "✎ Виправити" opens form with reason selector, inputs, and submit button) |
| **U3** | Timeline fake hardcoded `status: 'success'` | Step history mapping hardcoded `status: 'success'` for every line | Added `parseStepLine` with regex matching for errors (❌), warnings (⚠️), pauses (⏸️), skips (⏭️), corrections (✏️), timestamps `[HH:MM:SS]`, and status badges. | **PASS** (StepTimeline displays dynamic badges & timestamps) |
| **U4** | `stepTotal` missing / malformed in Viewport | `stepTotal` wasn't forwarded from survey status, display format lacked total | Extracted total steps from status data and formatted header counter as `Крок N / M`. | **PASS** (Live CDP & Vitest: displays `Крок 1 / 1`) |
| **U5** | `TextInput` onChange contract hack scattered in 13 files | Inconsistent event handling `(e as any)?.target?.value ?? ''` | Centralized `normalizeInputChange(val: unknown): string` in `primitives.tsx` and updated all 13 screens/panels. | **PASS** (0 scattered hacks remain; unit tests verify string & event extraction) |
| **U6** | Inconsistent Toast API (`toast()` vs `toast.show()`) | Core `@astryxdesign/core/Toast` expects `{ body, type }` while screens called `toast.show({ variant, title })`, causing runtime errors | Built universal `useAppToast` / `useToast` in `primitives.tsx` supporting both signatures and re-exported it across all components. | **PASS** (All screens use unified toast adapter without errors) |

---

### Verification Gates Evidence

#### Gate G3: Live CDP Zoom 270%+ Full scrollWidth
- **Endpoint**: `https://survey.exodus.pp.ua/ops`
- **CDP Host**: `192.168.3.184:9226` (Swiss-proxy browser via `.30`, cookie `astryx_k=oDWnckh7aaA8HOJiskM3uvvmUi7nQFX6`)
- **Metrics**:
  - `initialZoom`: `100%`
  - `zoomedLabel`: `270%`
  - `containerClientWidth`: `1254px`
  - `containerScrollWidth`: `3386px`
  - `innerRectWidth`: `3386px` (`width: 270%`, `minWidth: 270%`)
  - `scrollLeftReached`: `2132px` (`3386 - 1254 = 2132px`)
  - `canScrollRight`: `true`
  - `scrollCoversFullWidth`: `true`
- **Result**: **PASS**

#### Gate G4: Live CDP Fullscreen "Виправити" Correction Form
- **Endpoint**: `https://survey.exodus.pp.ua/ops?view=focus`
- **Action**: Clicked "✎ Виправити" button in expanded view
- **Metrics**:
  - `hasCorrectBtn`: `true`
  - `formOpened`: `true`
  - `formHasCancel`: `true`
  - `textareaCount`: `2` (override value + tutor note)
  - `reason_code` selector options: `wrong_element`, `bad_value`, `missed_captcha`, etc.
- **Result**: **PASS**

#### Gate G5: UI Invariants Check (`bin/ui_verify.sh`)
- `INV-1`: 0 HEX literals in `.tsx` -> **PASS**
- `INV-2`: `style={{` occurrences <= 17 (Found: 4) -> **PASS**
- `INV-3`: Max 250 lines per `.tsx` in `screens/` and `ops/` -> **PASS**
- `INV-7`: 0 `fontSize < 12px` in `.tsx` -> **PASS**
- `INV-8`: Agent contract schema and TypeScript definitions present -> **PASS**
- **Result**: **PASS (0 failures)**

#### Vitest Unit Suite
- `src/ops/Viewport.test.tsx`: 4 passed (U1, U2, U4, U5)
- `src/ops/ResumeTabCard.test.tsx`: 3 passed (G1, URL validation, submit)
- Total: 7 passed in 31.55s.

---

## Track A — Execution pipeline defects (F6/F7/F9/F10/F11/F13/F14)

**Виконавець**: Claude Opus-субагент. **Файли**: `survey_agent.py`,
`cdp_client.py`, `pipeline_bridge.py`, `astryx_survey_server.py`,
`tests/`. Нічого під `web/` не торкався (паралельна сесія Track B).

**Базова лінія pytest** (до Track A, гілка `astryx-ui-refactor` @ `538ba24`):
`5 failed, 60 passed, 1 skipped in 16.47s`
**Після Track A** (7 фіксів + 13 нових тестів): `5 failed, 73 passed, 1 skipped`
**Після merge Track B**: `5 failed, 73 passed, 1 skipped in 29.55s`

Той самий набір із 5 провалів у всіх трьох прогонах — усі преіснуючі й не
пов'язані з Track A (три перевіряють використання компонентів у `web/`, один —
фікстуру з кількістю правил, один — `~/.cloudflared/config.yml` цього хоста).
Нових регресій немає. `+13 passed` — рівно нові тести.

### Gate table

| # | Дефект | Команда / repro | Вивід | Вердикт |
|---|---|---|---|---|
| G0 | `impact()` перед кожним edit | `mcp__gitnexus__impact(...)` × 7 | 5 із 7 символів резолвляться; `verify_step`/`poll_operator_status` — `"Target not found"`, risk `UNKNOWN` (індекс на 22 коміти позаду HEAD, створений до 022-рефактору, який і породив `pipeline_bridge.py`). Реіндекс свідомо не запускався — він переписує `gitnexus`-блок у `AGENTS.md`/`CLAUDE.md` і стирає ручні правила. Для цих двох blast radius встановлено через `git grep`. | **PASS з відомим обмеженням** |
| F6 | `current_url` не оновлюється | `pytest -k f6` на засташеному vs поточному `survey_agent.py` | pre-fix: `AssertionError: current_url never advanced past the start page`; post-fix: `1 passed` | **PASS** |
| F7 | Нова вкладка не підхоплюється | `git grep check_and_attach_new_tab` → лише визначення + згадки в доках; далі `pytest -k f7` | pre-fix: `FAILED test_f7_new_tab_after_click_is_attached`; post-fix: `3 passed` (разом із тестом на не-захоплення чужої вкладки) | **PASS** |
| F9 | Виняток vision вбиває прогін | `pytest -k f9` pre/post | pre-fix лог: `[survey_agent] Unknown action 'wait' from Gemma — stopping.` + `AssertionError: run stopped after the vision error (only 1 vision calls)`; post-fix: `2 passed` | **PASS** |
| F10 | Тихий провал моста до тутора | `python3 repro_f10.py` (endpoint `127.0.0.1:1`) pre/post | pre-fix: `returned: None … elapsed 0.18s` / `STATE: <no TUTOR_BRIDGE_STATE attribute>` — абсолютна тиша. post-fix: `⚠️ [TutorBridge] verify_step FAILED at step 7 (1 in a row, 1 this run): URLError: <urlopen error [Errno 111] Connection refused> — the step proceeds AUTONOMOUSLY, without tutor verification.` / `returned: None … elapsed 0.19s` / `STATE: {'failures': 1, …}` | **PASS** (ковтання винятку збережене навмисно) |
| F11 | `paused` не зупиняє агента | живий сервер :5005, `POST /api/survey/pause`, потім свіжий процес + прогін циклу без капчі | `poll_operator_status() [in-process] = 'idle'` · `poll_operator_status_http() = 'paused'` · `poll_operator_status_live() = 'paused'`. Цикл: pre-fix `[!] VISION CALLED for step 1 at t+0.4s`, `agent finished at t+0.5s`; post-fix `⏸️ Paused by operator — holding before step 1`, `--- 8.0s elapsed; vision called yet? not finished ---`, `▶️ Resumed by operator after 8s`, `[!] VISION CALLED for step 1 at t+8.9s` | **PASS** |
| F13 | Збій browser_sources без запису | `python3 repro_f13.py` — справжній `CDPError` зі справжнього `CDPClient` (`--cdp-target no-such-source-key`), потім `SELECT … FROM run_traces` | pre-fix: `outcome=None ended_at=None outcome_reason=None` → `>>> ETERNALLY OPEN (outcome IS NULL) <<<`; post-fix: `outcome='error' ended_at='2026-08-15T16:02:58Z' outcome_reason="setup_failed: CDPError: No browser_source with key='no-such-source-key' found (Settings → Браузер)"` → `CLOSED (ok)` | **PASS** |
| F14 | Факти не поповнюються | `python3 repro_f14.py` — прогін типує `Ihr Beruf=Elektriker` і `Passwort=hunter2` | pre-fix: `get_facts('arno') = {}`, секції в промпті немає. post-fix: `Recorded 1 learned fact(s) for arno: ['ihr_beruf']`, `get_facts('arno') = {'ihr_beruf': 'Elektriker'}`, `password leaked into facts? False`, секція `РАНІШЕ ЗАФІКСОВАНІ РЕАЛЬНІ ВІДПОВІДІ` містить `* **ihr_beruf**: Elektriker` | **PASS** |
| G2 | Регресія `pytest tests/` | див. цифри вище | ідентичний набір із 5 преіснуючих провалів до і після | **PASS** |

### Знахідка, що змінила форму фіксу F11 (і виходить за межі 7 дефектів)

`survey_agent.py` запускається як **підпроцес** сервера
(`run_survey_execution()` → `subprocess.Popen`). Тому
`pipeline_bridge.poll_operator_status()` з його `import astryx_survey_server`
отримує **свіжий модуль**, чий `ACTIVE_SURVEY_STATE` завжди дорівнює
початковому `{'status': 'idle'}` — це ніколи не стан сервера. Виміряно:

```
$ python3 -c "import pipeline_bridge; print(pipeline_bridge.poll_operator_status())"
idle
```

Наслідок для F11: паузу неможливо побачити через внутрішньопроцесний шлях,
тому доданий `poll_operator_status_http()` + `poll_operator_status_live()`
(HTTP спершу, in-process як фолбек). `poll_operator_status()` лишено
байт-у-байт як у 022 — гарантія еквівалентності не зачеплена.

**Не виправлено (поза Track A, потребує рішення Q):** та сама причина ламає
**гілку капчі**. Цикл очікування (`survey_agent.py`) на першому ж опитуванні
отримує сталу `'idle'`, що збігається з `run_state.IDLE` → лог
`"Task aborted by operator."` і `stop_reason='aborted_by_operator'` приблизно
через 2 с після детекту капчі, хоча оператор нічого не робив. Симетрично
`report_blocking()` пише `waiting_verification` у власну копію модуля, тож
оператор ніколи не бачить капчу в UI. Обидва лікуються тим самим переходом на
HTTP, але це зміна поведінки поза переліком із семи дефектів — навмисно не
зроблена без підтвердження.

### Чесні застереження

- **Немає живого автономного прогону.** `~/llm-switch.sh` на цьому хості не
  існує, тому наскрізний прогін опитування тут виконати неможливо. F6/F7/F9/F14
  доведені на рівні функцій і циклу з фейковими CDP/vision; F10/F11/F13 —
  проти справжнього Flask-сервера на :5005 та справжньої sqlite-схеми.
- **G0 частковий** — див. рядок таблиці: два символи не резолвяться через
  застарілий індекс GitNexus.
- Гейти G3-G6 належать Track B / деплою і тут не оцінюються.
- `tests/integration/test_p5_self_healing.py` отримав однорядкову правку
  фікстури (`mock_cdp.check_and_attach_new_tab.return_value = None`): голий
  `MagicMock` повертає truthy-об'єкт там, де справжній `CDPClient` повертає
  `None`. Це прогалина точності фейка, а не зміна поведінки продакшену.
