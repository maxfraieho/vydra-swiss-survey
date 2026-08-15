# agy prompt 020-C — «Deploy Truth»: довести 020 до живого екрана

Методика: /ssd. Мова відповіді: українська. Стиль: коротко, факти.

## Контекст (не обговорюється, це виміряно ззовні)

Живий домен `https://survey.exodus.pp.ua` роздає **старий інтерфейс**:
- навігація має 9 пунктів у 4 секціях (`/rules`, `/rules/compare`, `/rules/conflicts`,
  `/gate`, `/traces`, `/report`, `/ops`, `/settings`), а не 5;
- `/ops?view=fullscreen` віддає той самий DOM, що `/ops` (немає режимів viewport);
- у бандлі `assets/index-*.js`: **0 згадок** `view=`, `reason_code`, «Пульт», «Навички»;
- `/gate` існує окремо, Host Gate не в Settings;
- екран Ops — старий монолітний «Режим Навчання» з ~18 кнопками.

Отже: код 020 у гілці є, але **не підключений у `main.tsx`** або `web/dist` зібраний
не з нього. Звіт «25/25 PASS» недійсний: `bin/ui_verify.sh` перевіряє файли, а не те,
що код досяг екрана.

## RULE #0 — заборона PASS без runtime-доказу

PASS ставиться лише тоді, коли твердження підтверджене **запитом до живого URL**
`https://survey.exodus.pp.ua`, а вивід збережено у файл. Немає файлу — статус FAIL.
Скріншоти, яких немає в git tree, не існують.

## Крок 1 — знайти розрив source ↔ deploy

```bash
cd <repo>; git checkout astryx-ui-refactor && git pull
rg -n "Viewport|useViewportMode|view=" web/src/main.tsx web/src/shell web/src/screens/SurveyOps.tsx
rg -n "createBrowserRouter|<Route|path=\"/gate\"|/rules/compare|/rules/conflicts" web/src
```
Записати у `docs/astryx-refactor/evidence/020C/00-wiring-gap.txt`:
які компоненти 020 існують і **хто їх імпортує** (якщо ніхто — це і є причина).

## Крок 2 — підключити 020 у роутер і навігацію (це і є робота)

1. `main.tsx`: 5 маршрутів верхнього рівня — `/ops` (index redirect сюди), `/rules`,
   `/traces`, `/settings`, `/analytics`. Видалити `/gate`, `/rules/compare`,
   `/rules/conflicts` як окремі пункти SideNav:
   - Host Gate → таб у `/settings?tab=hosts`;
   - Compare → дія у `/traces` (вибір 2 прогонів);
   - Conflicts → бейдж-лічильник біля «Правила» + inline-панель у RuleDetail.
2. `/ops` рендерить `ops/Viewport.tsx` і читає `?view=inline|focus|fullscreen`
   (двосторонній sync: зміна режиму → `replaceState` URL).
3 `reason_code` показується у `AttentionCard` і пишеться в trace.

## Крок 3 — прибрати dist з git

`web/dist/` → `.gitignore`, `git rm -r --cached web/dist`. Деплой лише скриптом
`build-deploy.sh`. Причина: закомічений бандл маскує розбіжність source↔deploy.

## Крок 4 — новий машинний гейт `bin/deploy_verify.sh`

Має падати з кодом ≠0, якщо на живому URL не виконано:

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://survey.exodus.pp.ua}"
OUT=docs/astryx-refactor/evidence/020C; mkdir -p "$OUT"
JS=$(curl -s "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -n1)
curl -s "$BASE/$JS" -o /tmp/bundle.js
fail=0
for token in "view=fullscreen" "reason_code"; do
  n=$(grep -o -F "$token" /tmp/bundle.js | wc -l)
  echo "bundle:$token=$n" | tee -a "$OUT/10-bundle-tokens.txt"
  [ "$n" -gt 0 ] || { echo "FAIL: $token відсутній у задеплоєному бандлі"; fail=1; }
done
node bin/dom_probe.mjs "$BASE" | tee "$OUT/11-dom-probe.json"   # playwright/puppeteer
exit $fail
```

`bin/dom_probe.mjs` (headless) мусить перевірити і надрукувати JSON:
- `navCount === 5` і точний список href;
- `/ops?view=fullscreen` дає DOM, **відмінний** від `/ops` (різні `innerText.length`
  або наявність `[data-viewport-mode="fullscreen"]`);
- на 390px `scrollWidth - clientWidth === 0` на кожному з 5 маршрутів;
- `/gate` → 301/redirect на `/settings?tab=hosts`;
- 0 `pageerror`.

## Крок 5 — evidence (обов'язково в git)

`docs/astryx-refactor/evidence/020C/`:
`00-wiring-gap.txt`, `10-bundle-tokens.txt`, `11-dom-probe.json`,
`20-ui_verify.txt`, `21-deploy_verify.txt`,
скріншоти `30-ops-inline.png`, `31-ops-focus.png`, `32-ops-fullscreen.png`,
`33-ops-390.png` (усі мають різний sha256 — перевір `sha256sum` і додай у
`40-checksums.txt`; однакові хеші = FAIL).

## Крок 6 — звіт

`docs/astryx-refactor/evidence/020C/deploy-report.md`: таблиця пункт→команда→вивід→статус.
Кожен PASS має посилання на файл evidence. Якщо щось не зроблено — писати FAIL,
не «PASS з приміткою». Запушити в `astryx-ui-refactor`.

## Definition of Done

`bin/ui_verify.sh` **і** `bin/deploy_verify.sh https://survey.exodus.pp.ua` виходять з 0,
а `curl` живого бандла містить `view=fullscreen` і `reason_code`.
