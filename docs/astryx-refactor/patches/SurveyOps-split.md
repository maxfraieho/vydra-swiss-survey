# Етап B2 — розбиття `SurveyOps.tsx` (1084 рядки, 77 inline, 29 HEX)

Найбільший борг проєкту в одному файлі. Розбити на 5 компонентів + контейнер.
Логіку (polling, мутації) НЕ переписувати — тільки виносити з presentation.

## Нова структура `web/src/screens/ops/`

| Файл | Що містить | Астрікс-компоненти | Ціль рядків |
|---|---|---|---|
| `SurveyOps.tsx` | контейнер: polling `/api/survey/status`, роутинг hash `#pending`, склейка зон | `VStack`, `PageHeader` | ≤ 140 |
| `PendingDecision.tsx` | **зона 1** — HITL-картка: питання, варіанти, кнопки «Підтвердити / Виправити / Пропустити» | `Card`, `Banner`, `Button`, `TextArea`, `Selector` | ≤ 200 |
| `StepTimeline.tsx` | **зона 2** — поточний крок, історія кроків, прогрес | `Card`, `ProgressBar`, `Badge`, `CodeBlock` | ≤ 180 |
| `ScreenshotView.tsx` | скріншот кроку + zoom у `Dialog` | `Card`, `Dialog`, `Layout` | ≤ 90 |
| `RecentRuns.tsx` | **зона 3** — останні 5 прогонів, лінки на `/traces/:runId` | `DataList` (з `ui/primitives`) | ≤ 80 |
| `LaunchDialog.tsx` | форма запуску опитування (переїжджає з половини екрана у `Dialog`) | `Dialog`, `FormGrid`, `TextInput`, `Selector`, `Button` | ≤ 160 |

## Порядок зон на `/ops` (C2)

```text
┌──────────────────────────────────────────────┐
│ PageHeader: "Пульт"  [Запустити опитування]  │  ← кнопка відкриває LaunchDialog
├──────────────────────────────────────────────┤
│ ЗОНА 1  PendingDecision  (id="pending")      │  ← або EmptyState «Нічого не чекає»
│         банер error, коли waiting_verification│
├──────────────────────────────────────────────┤
│ ЗОНА 2  StepTimeline + ScreenshotView        │  ← 2 колонки >480px, 1 колонка на телефоні
├──────────────────────────────────────────────┤
│ ЗОНА 3  RecentRuns (5 останніх)              │
└──────────────────────────────────────────────┘
```

Оператор бачить дію, що від нього чекають, без жодного скролу на 390×844 —
це основний критерій приймання цього кроку.

## Заміни HEX (29 входжень)

| Було | Стане |
|---|---|
| `#22c55e` / зелені | `var(--color-text-green)` або `<Badge variant="success">` |
| `#ef4444` / червоні | `var(--color-text-red)` / `variant="error"` |
| `#f59e0b` / жовті | `var(--color-text-yellow)` / `variant="warning"` |
| `#0f172a`, `#1e293b`, `#020617` (фони карток) | `<Card>` без власного фону |
| `#3b82f6` (акцент кнопок) | `<Button variant="primary">` |
| ручні `getBadgeVariant` | `SurveyStatusPill` з `ui/primitives` |

## Клік-зони

Усі `padding: '4px 8px'` / `'6px 14px'` на `<button>` → `<Button>` Astryx
(44px за замовчуванням). Жодного сирого `<button>` у цьому каталозі не лишається.
