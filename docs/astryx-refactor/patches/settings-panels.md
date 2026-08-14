# Етап B4–B5 — панелі та решта екранів (механічні заміни)

Один коміт на файл. Після кожного: `npx eslint src/<файл>` має бути чистим.

## Мапа замін

| Файл | inline / HEX | Замінити на |
|---|---|---|
| `settings/AISourcePanel.tsx` | 26 / 2 | `PageHeader`, `FormGrid columns={2}`, `FormActions`, `KeyValueList`, `TextInput type="password"` для ключа моделі |
| `settings/PersonasPanel.tsx` | 24 / 1 | `MasterDetail` (замість `'320px 1fr'` безумовного), `FormGrid` замість `'1fr 1fr 120px'`, `DataList` для списку персон |
| `settings/BrowserSourcesPanel.tsx` | 22 / 2 | `DataList` + `KeyValueList` (уже частково є `MetadataList`), `FormGrid`, `Switch` для `enabled`, результат перевірки джерела → `Banner` замість `<div>` з рамкою |
| `settings/HostsPanel.tsx` | 17 / 0 | `DataList`, `FormGrid`, `FormActions`; сирі `<button type="button">` → `<Button>` |
| `settings/PatternsPanel.tsx` | 17 / 0 | те саме + `Selector` для polarity |
| `settings/ProvidersPanel.tsx` | 17 / 0 | те саме + `TextInput type="password"` для секретів |
| `settings/TelegramSettingsPanel.tsx` | 9 / 0 | `FormGrid`, `FormActions`, `Banner` для стану вебхука |
| `rules/RuleDetail.tsx` | 26 / 6 | `KeyValueList` замість `'1fr 1fr'`, `CodeBlock` замість `<pre style={{overflowX:'auto'}}>`, `RuleStatusPill` |
| `rules/Conflicts.tsx` | 23 / 2 | `DataList`, `Badge` для типу конфлікту, `EmptyState` «Конфліктів немає» |
| `rules/BehaviorEditor.tsx` | 21 / 2 | `TextArea`, `FormGrid`, `FormActions`, `CodeBlock` для прев'ю |
| `rules/Compare.tsx` | 19 / 1 | `DataList`, `Selector` для вибору сторін порівняння |
| `audit/Traces.tsx` | 16 / 0 | `MasterDetail` (деталь уже `Dialog` — прибрати другий механізм), `DataList`, `OutcomePill` |
| `audit/TraceDetail.tsx` | 16 / 2 | `KeyValueList`, `CodeBlock`, стрічка кроків → `VStack` з `Card` на крок |
| `gate/HostGate.tsx` | 32 / 5 | `PageHeader`, `FormGrid`, `KeyValueList`, `Banner` для результату гейту |
| `audit/Report.tsx` | 4 / 0 | `EmptyState` / `ErrorState` замість текстових станів |
| `ui/MermaidTree.tsx` | 10 / 2 | лишити власний рендер, але прибрати `fontSize: 9–11px` (мінімум 12) і 2 HEX → токени |
| `rules/RuleComposer.tsx` | 9 / 0 | `FormGrid`, `Selector`, `FormActions`; відкривати як `Dialog` з RulesTable |

## Типографіка (B6)

`rg "fontSize: '(9|10|11)px'" web/src` → усе підняти до 12px мінімум
(або прибрати взагалі, віддавши `<Text type="supporting">`).

## markdown-table.css (B7)

3155 рядків, 12 HEX. Дії:
1. Обгорнути весь файл у `@layer components { … }` (шар уже оголошений у `styles/layers.css`).
2. HEX → `var(--color-*)`.
3. Видалити правила, що дублюють `@astryxdesign/core/Markdown` (він уже імпортується в 7 місцях) — залишити тільки те, що реально не покривається компонентом. Очікуваний результат ≤ 300 рядків.
