# Промт для Antigravity CLI (`agy`) — Feature 020: Ops Viewport + ревізія вкладок

> Виконуй строго за SDD-методикою проєкту (`docs/for-agents/sdd-development-methodology.md`).
> Не починай кодити, поки не існує спека і не пройдено гейт кроку 0.
> Кожен крок = окремий коміт з префіксом `feat(020):` / `refactor(020):` / `chore(020):`.

## 0. Оточення

```bash
# хост розробки перенесено з 192.168.3.196 на 192.168.3.184
ssh vokov@192.168.3.184          # пароль передається інтерактивно ($SSH_PASS), у пароля крапка в кінці
cd ~/vydra-swiss-survey
df -h .                          # якщо < 5 ГБ вільно — спочатку прибрати:
#   bun pm cache rm; npm cache clean --force; rm -rf ~/.cache/ms-playwright
#   docker system prune -af --volumes ; journalctl --vacuum-size=200M
git remote -v                    # origin = github.com/maxfraieho/vydra-swiss-survey
git fetch origin && git checkout astryx-ui-refactor && git pull --ff-only
ls docs/astryx-refactor/         # тут план, tokens.ts, primitives.tsx, патчі
```

## 1. GitNexus — індекс проєкту

Перед аналізом і після кожного кроку 1–5:

```bash
gitnexus index --root . --update          # оновити індекс
gitnexus query "SurveyOps screenshot render"   # знайти всі точки рендера кадру
gitnexus query "inline style hex color tsx"    # мапа боргу
gitnexus query "HostGate Compare Conflicts route entry"  # чи є вхід на екран
```

Використовуй індекс **обов'язково** у таких місцях:
- перед розбором `SurveyOps.tsx` — знайти всі імпорти/споживачі, щоб не зламати `SurveyOps` API;
- перед видаленням/переносом `HostGate`, `Compare`, `Conflicts` — знайти всі посилання (`Link to=`, роут, тести);
- після кожного рефакторингу — `gitnexus query "unused export"` і прибрати мертві експорти;
- у PR-описі додай вивід `gitnexus stats` до/після (рядки, файли > 250, кількість inline-стилів).

Якщо `gitnexus` індекс застарілий — `gitnexus index --root . --rebuild` (повний), інакше `--update`.

## 2. Крок 0 — Спека (SDD-гейт)

Створи `specs/020-ops-viewport-and-tabs/` з `spec.md`, `plan.md`, `tasks.md`, `contracts/`.
`spec.md` мусить містити розділ **Invariants (machine-checkable)**:

```
INV-1  0 HEX-літералів у web/src/**/*.tsx
INV-2  сума `style={{` у web/src/**/*.tsx <= 40
INV-3  жоден .tsx у web/src/screens|web/src/ops не довший за 250 рядків
INV-4  на 390x844 немає горизонтального скролу на /ops, /traces, /rules
INV-5  кожен роут має вхід з робочого потоку (немає «сиротних» екранів)
INV-6  fullscreen viewport не втрачає зум/пан при новому кадрі
INV-7  0 входжень `fontSize: 9px|10px|11px` у web/src/**/*.tsx (мінімум системи 12 px)
INV-8  контракт агент↔UI типізований: web/src/types/agent.ts генерується/валідується зі
       specs/020-ops-viewport-and-tabs/contracts/agent_intent.schema.json, UI не читає
       нетипізовані поля кадру/наміру
```

Додай `bin/ui_verify.sh`, що перевіряє INV-1..INV-3 та INV-7 (rg), INV-4 (playwright), повертає != 0 при порушенні, і підключи його до `bin/sdd_verify.sh` та CI. **Спочатку скрипт (він має падати), потім код.**

## 3. Кроки реалізації

Джерело істини по вимогах — `docs/astryx-refactor/` (план рефакторингу + verify-and-teaching-plan) і новий `ops-browser-and-tabs-plan.md`.

0. **Контракт (блокує крок B).** `specs/020-ops-viewport-and-tabs/contracts/agent_intent.schema.json` — JSON Schema для кадру і наміру агента: `frame_id`, `url`, `step_index`, `step_total`, `status`, `agent_intent { action, target_selector?, target_bbox { x, y, w, h }` (нормалізовані 0..1) `, confidence 0..1, rationale }`, `human_correction { kind, reason_code, point? { x, y }, note? }`, `reason_code` — enum з 6 значень. Згенеруй з неї `web/src/types/agent.ts` і рантайм-валідатор; кадри, що не валідні, показуй як явну помилку в UI, а не «пусто». Коміт: `feat(020): agent↔ui contract`.
1. **A. Примітиви.** Прийми `web/src/ui/tokens.ts` і `web/src/ui/primitives.tsx` з `docs/astryx-refactor/web/`. Додай ESLint-огорожу з `patches/eslint.config.js.patch`. Коміт: `chore(020): ui primitives + lint fence`.
2. **B. Viewport.** `web/src/ops/Viewport.tsx` + `useViewportMode.ts`: режими `inline | focus | fullscreen`, стан у URL `?view=`, `requestFullscreen`, пінч-зум/пан, оверлей bbox (з типів кроку 0), режим «вкажи елемент» (нормалізовані 0..1 координати в `human_correction.point`), верхня смуга (статус, URL, крок) і нижня смуга 1-tap дій із safe-area. Esc/✕/свайп — вихід. Хоткеї `F`, `1`, `2`, `Space`.
3. **C. Розбір `SurveyOps.tsx` (1563 рядки).** На `ops/AttentionCard.tsx`, `ops/AgentIntent.tsx`, `ops/StepTimeline.tsx`, `ops/LaunchForm.tsx`, `ops/RecentRuns.tsx`, `ops/Viewport.tsx`. `SurveyOps.tsx` лишається композицією ≤ 150 рядків. Фічу 018 (screencast-tutor-relay) не ламати — перенести її хуки в `ops/useTutorRelay.ts`.
4. **D. IA і вкладки.** Нав = 3 секції / 5 пунктів (Пульт оператора, Прогони, Навички агента [бейдж конфліктів], Звіт, Налаштування). `HostGate` → таб `Settings → Доступи` + інлайн-банер дозволу домену в Пульті. `Compare` → дія з Прогонів (2 чекбокси → панель), не пункт меню. `Conflicts` → інлайн-блок у деталі правила + бейдж-лічильник; окремий екран лишається як «усі конфлікти» без пункту в нав. Перейменування українською: `shadow/active` → «на випробуванні / діє».
5. **E. Навчальний цикл.** Обов'язковий `reason_code` при правці людини, таймер очікування, ескалація до тутор-LLM при впевненості < 0.6, запис уроку в `lessons.md` і його підмішування в CoT-промт агента.

## 4. Гейти приймання (не мерджити без цього)

```bash
bin/sdd_verify.sh && bin/ui_verify.sh
bun run typecheck && bun run build
rg -c '#[0-9a-fA-F]{6}' web/src --glob '*.tsx' || echo OK   # мусить бути OK
rg -o 'style=\{\{' web/src --glob '*.tsx' | wc -l           # <= 40
awk 'END{}' ; for f in $(rg -l '' web/src --glob '*.tsx'); do n=$(wc -l <"$f"); [ "$n" -gt 250 ] && echo "LONG $n $f"; done
```

Плюс скріншоти playwright 390×844 і 1280×800 для `/ops` (усі три режими viewport), `/traces`, `/rules` — покласти в `specs/020-ops-viewport-and-tabs/evidence/`.

## 5. Веб-інтерфейс на новому хості

```bash
bun install
bun run dev --host 0.0.0.0 --port 5173     # доступ http://192.168.3.184:5173
rg -n '192\.168\.3\.196' -g '!node_modules' .   # замінити на 192.168.3.184 або env
sudo ufw allow 5173/tcp
```
Перевір, що бекенд/relay URL не зашиті на старий IP, а читаються з `.env` (`VITE_API_BASE`).

## 6. Звіт

Пуш у `astryx-ui-refactor`, PR у `master` з описом: виконані INV, `gitnexus stats` до/після, таблиця «екран → вердикт → що зроблено», посилання на evidence-скріншоти. Якщо якийсь INV не досягнутий — **не приховуй**, напиши цифру і причину.
