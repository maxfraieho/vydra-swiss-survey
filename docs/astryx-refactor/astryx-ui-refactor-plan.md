# План рефакторингу Astryx UI — `vydra-swiss-survey/web`

**База:** дамп проєкту від 2026-08-13 14:45 (47 файлів у `web/`, 18 екранів).
**Фокус:** візуал і консистентність + інформаційна архітектура + мобільна поведінка.
**Продовження:** `astryx_audit_plan.md` (2026-08-09). Етапи 0–2 того плану **виконані** — далі йде те, що лишилось.

---

## 1. Що вже добре (не ламати)

- `styles/layers.css` існує і імпортується першим у `main.tsx` → каскад захищений.
- Каркас нативний: `AppShell` + `TopNav` + `SideNav` + `StatusBar` (`Badge`/`Banner`).
- Astryx-компоненти реально використовуються: **189 імпортів** з `@astryxdesign/core` у 30 файлах.
- `SettingsPage` уже на `TabList`, `Nav` на `SideNav`/`SideNavSection`.

## 2. Актуальні заміри (по дампу)

| Метрика | Зараз | Було 2026-08-09 | Ціль |
|---|---|---|---|
| `style={{}}` у TSX | **438** | 526 | ≤ 40 (тільки geometry: grid/flex-basis) |
| Хардкоджені HEX у TSX | **~65** (SurveyOps 29, RuleDetail 6, RulesTable 6, HostGate 5, MermaidTree/TraceDetail/BehaviorEditor/Conflicts по 2) | 654 | **0** |
| `index.html` inline HEX | 2 | 2 | 0 |
| Файли > 300 рядків | `SurveyOps.tsx` **1084**, `RulesTable.tsx` 618, `AISourcePanel` 379, `RuleDetail` 359, `BrowserSourcesPanel` 356, `PersonasPanel` 316 | — | ≤ 250 |
| `markdown-table.css` | **3155 рядків** | — | ≤ 300, у `@layer components` |

Головний борг сконцентрований у 6 файлах: **SurveyOps, RulesTable, RuleDetail, HostGate, AISourcePanel, BrowserSourcesPanel** = ~215 з 438 inline-блоків.

---

## 3. Етап A — «Один шар примітивів» (1 день, 3 нові файли)

Причина, чому inline-стилі відроджуються: немає куди подіти повторювані патерни. Створити тонкий локальний шар над Astryx і забороняти `style={{}}` поза ним.

**A1. `web/src/ui/tokens.ts`** — єдине джерело значень, без HEX:

```ts
// Дозволені значення для layout-пропів. HEX у TSX заборонені лінтером.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const statusColor = {
  idle: 'var(--color-text-tertiary)',
  running: 'var(--color-accent-info)',
  waiting_auth: 'var(--color-accent-warning)',
  waiting_verification: 'var(--color-accent-error)',
  finished: 'var(--color-accent-success)',
  error: 'var(--color-accent-error)',
} as const;
export const outcomeBadge = { win: 'success', loss: 'error', partial: 'warning', unknown: 'neutral' } as const;
```

**A2. `web/src/ui/primitives.tsx`** — 6 компонентів, що вбивають ~70 % повторів:

| Примітив | Замінює | Де застосувати |
|---|---|---|
| `<Section title eyebrow actions>` | картку-заголовок з `eyebrow`-спаном (`SettingsPage:31-41` і ще 7 екранів) | усі екрани |
| `<MasterDetail list detail>` | `gridTemplateColumns: isNarrow ? '1fr' : '1fr 420px'` + `Dialog` на mobile | RulesTable, Traces, PersonasPanel, HostGate |
| `<DataTable columns rows onRowClick>` | 8 сирих `<table>` + `overflowX:auto`; на вузькому екрані рендерить `ListItem`-картки | Rules/Traces/Hosts/Patterns/Providers/Compare/Conflicts |
| `<FormGrid>` | 9 місць `gridTemplateColumns:'1fr 1fr'` | усі панелі налаштувань, RuleComposer |
| `<StatusPill value>` | ручні `Badge`+HEX мапінги (5 копій `getBadgeVariant`) | StatusBar, RulesTable, Traces, Ops |
| `<KeyValue items>` | `1fr 1fr` метадані + `<pre>` | RuleDetail, TraceDetail |

**A3. ESLint-огорожа** (`web/eslint.config.js`) — щоб борг не повернувся:

```js
rules: {
  'no-restricted-syntax': [
    'error',
    { selector: "JSXAttribute[name.name='style'] Property[key.name=/^(background|backgroundColor|color|borderColor|fontSize|fontWeight)$/]",
      message: 'Кольори/типографіка — лише через Astryx-пропи або var(--color-*). Дивись ui/primitives.tsx.' },
    { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
      message: 'HEX у TSX заборонено — використай токен var(--color-*).' },
  ],
}
```
Виняток файлами: `src/theme/**` (генерується), `ui/primitives.tsx`.

---

## 4. Етап B — Візуал і консистентність (2–3 дні)

Порядок = за обсягом боргу, кожен файл окремим комітом.

1. **`index.html:9`** — прибрати `background:#020617` та другий HEX; фон дає `<Theme mode="dark">`.
2. **`SurveyOps.tsx` (77 inline, 29 HEX, 1084 рядки)** — розбити на `ops/StatusHeader.tsx`, `ops/PendingDecision.tsx` (HITL-картка), `ops/StepTimeline.tsx`, `ops/LaunchForm.tsx`, `ops/ScreenshotView.tsx`. HEX → `statusColor`, картки → `Card`, прогрес → `ProgressBar`, дії → `Button` (44 px за замовчуванням).
3. **`RulesTable.tsx` (45/6/618)** — таблиця → `DataTable`, деталь → `MasterDetail`, фільтри → `Selector`+`TextInput` у `<Section actions>`; вивести `RulesFilters.tsx` і `RuleRow` окремо.
4. **`RuleDetail.tsx`, `HostGate.tsx`, `AISourcePanel.tsx`, `BrowserSourcesPanel.tsx`, `PersonasPanel.tsx`** — `KeyValue`/`FormGrid`/`CodeBlock`; секрети → `TextInput type=password` + `Switch`.
5. **Решта панелей і `Compare`/`Conflicts`/`TraceDetail`/`Report`** — `DataTable` + `Badge`; порожні стани → один спільний `<EmptyState>` (додати до примітивів; текст + дія, не сирий рядок).
6. **Типографіка** — вигребти `fontSize: 9–11px` (у дампі ще лишились у MermaidTree/Traces/Conflicts): мінімум системи 12 px, монопростір лише в `CodeBlock`.
7. **`markdown-table.css` (3155 рядків)** — розділити: базові таблиці лишити, решту переписати на токени, обгорнути в `@layer components`, видалити 12 HEX.

**Правило приймання коміту:** `rg "style=\{\{" <файл>` не зростає, `rg "#[0-9a-f]{6}" <файл>` = 0, скріншот 390 px без горизонтального скролу.

---

## 5. Етап C — Інформаційна архітектура (1–2 дні)

Зараз 4 секції `SideNav` з 8 пунктами, вхід на `/rules`, а операторський екран (HITL) — третій у списку. Це неправильний пріоритет: оператор 90 % часу чекає на верифікацію.

**C1. Нова навігація (3 секції замість 4):**

```
Операції   → /ops        (Пульт, DEFAULT landing замість /rules)
             /traces      Прогони
             /report      Звіт
База знань → /rules       Правила
             /rules/conflicts  Конфлікти   ← бейдж-лічильник у SideNavItem
             /rules/compare    Порівняння
             /gate        Гейт хоста
Налаштування → /settings
```
- `main.tsx`: `index` → `Navigate to="/ops"`; `*` → `/ops`.
- `Nav.tsx`: `SideNavItem` для конфліктів отримує `endContent={<Badge variant="error" label={count}/>}` з `usePolling('/api/rules/conflicts/count')` — конфлікти зараз невидимі, поки не зайдеш.
- Прибрати емодзі з назв секцій (`🧠`, `🔍`, `🎓`, `⚙️`) → `SideNavSection title` + `icon` з `theme/icons.tsx`; емодзі в заголовках ламають вирівнювання і не масштабуються.

**C2. `/ops` як справжній пульт:** три зони згори вниз — (1) активна HITL-дія або «нічого не чекає», (2) поточний крок + скріншот, (3) останні 5 прогонів з посиланням у `/traces/:runId`. Запуск опитування переїжджає у `Dialog`, а не займає пів екрана.

**C3. HITL-нотифікація глобальна:** `StatusBar` уже показує `Banner`, але кнопка веде на `/` (→ редірект). Замінити на `href="/ops"` + `#pending`, і додати `document.title`-мигання лишити як є (працює).

**C4. Deep-link консистентність:** `Traces` тримає деталь у роуті (`/traces/:runId`), `RulesTable` — у локальному стейті. Уніфікувати: `/rules/:ruleId` (щоб деталь правила можна було переслати в Telegram).

**C5. Налаштування — 7 табів на телефоні не влазять.** `TabList` → на вузькому екрані `Selector` (dropdown) або згорнутий accordion-список панелей.

---

## 6. Етап D — Мобільна поведінка (0.5 дня, після A/B)

- Після `MasterDetail` і `DataTable` хук `useIsNarrow` лишається в 2–3 місцях; решту адаптивності віддати `AppShell`/CSS-контейнерам.
- Чек-ліст ручного тесту на 390×844: SideNav-шторка (фокус усередину, закриття на зміну маршруту, повернення фокуса), відсутність горизонтального скролу на кожному з 8 маршрутів, усі клік-зони ≥ 44 px, HITL-банер видно без скролу.

---

## 7. Порядок і оцінка

| Етап | Обсяг | Ризик | Результат |
|---|---|---|---|
| A. Примітиви + лінтер | 1 день, +3 файли | низький | борг перестає рости |
| B. Візуал (7 підкроків) | 2–3 дні, ~20 файлів | середній (регресії верстки) | 0 HEX, ≤40 inline |
| C. IA | 1–2 дні, `main.tsx` + `Nav` + `ops/*` | середній (зміна URL за замовчуванням) | оператор бачить HITL одразу |
| D. Мобільна перевірка | 0.5 дня | низький | чистий телефон |

**Разом ≈ 5–7 днів.** A обов'язково перший — без нього B і C відтворять ті ж 438 inline-блоків.

## 8. Definition of Done

1. `rg -c "style=\{\{" web/src --stats` ≤ 40, усі — geometry.
2. `rg "#[0-9a-fA-F]{6}" web/src --glob '!theme/**'` → нуль.
3. `npx astryx doctor` без попереджень; `npm run theme:build` + `bin/build_web.sh` чисті.
4. Жодного файлу екрана > 250 рядків.
5. Скріншоти 390 px усіх 8 маршрутів без горизонтального скролу, вкладені в PR.
