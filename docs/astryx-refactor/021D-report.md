# Feature 021D — Report

## Симптом
Поле «URL відкритої вкладки» в блоці «Продовжити у відкритій вкладці» не приймало клавіатурний
ввід і вставку. Персона-селект працював.

## Корінь причини

`web/node_modules/@astryxdesign/core/dist/TextInput/TextInput.d.ts:120`:
```ts
onChange?: (value: string, e: ChangeEvent<HTMLInputElement>) => void;
```
Перший позиційний аргумент `TextInput.onChange` — це вже готовий **рядок значення**, не
React-подія (сама документація компонента показує `<TextInput onChange={setName} />`).

`ResumeTabCard.tsx` (і ще 12 файлів у кодовій базі — той самий паттерн, написаний в
попередніх AGY-сесіях 021B/раніше) робив:
```ts
onChange={(e) => setTabUrl(e.target.value)}
```
Оскільки `e` фактично був рядком (не подією), `e.target` — `undefined`, `.value` на
`undefined` кидає виняток на КОЖНЕ натискання клавіші → стан ніколи не оновлювався →
поле візуально виглядало "мертвим". Той самий баг стояв за вставкою (Ctrl+V теж іде через
`onChange`).

## Виправлення

`web/src/ops/ResumeTabCard.tsx`:
- `onChange={(val) => setTabUrl(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}` —
  приймає обидва можливих контракти (рядок напряму АБО подію), безпечно.
- Додано `isValidUrl()` (реальна `new URL()`-перевірка, protocol http/https) — кнопка
  «Продовжити» активна лише при валідному URL (вимога G2/G5).
- `notify()`-хелпер навколо toast API (захист від відмінностей сигнатури `toast()`/`toast.show()`).

Той самий фікс-паттерн застосовано ще в 12 файлах з ідентичним багом:
`AttentionCard.tsx`, `LaunchForm.tsx`, `BehaviorEditor.tsx`, `RuleComposer.tsx`,
`RuleDetail.tsx`, `AISourcePanel.tsx`, `BrowserSourcesPanel.tsx`, `HostsPanel.tsx`,
`PatternsPanel.tsx`, `PersonasPanel.tsx`, `ProvidersPanel.tsx`,
`TelegramSettingsPanel.tsx` — усі мали той самий `(e) => setX(e.target.value)` на
`TextInput`/`TextArea`, тобто весь клас полів у консолі оператора мав ту саму ваду.

## Verification Gates

| Гейт | Команда | Результат |
|---|---|---|
| G1 | `npx vitest run src/ops/ResumeTabCard.test.tsx` | **PASS** — 3/3 тести, включно з `userEvent.type` (9.25с) |
| G2 | ручний тест (не виконано в цій сесії — AGY-процес обірвався на print-timeout) | не підтверджено вручну, покрито G1 (те саме через jsdom) |
| G3 | не тестовано окремо (компонент не має власної блокуючої логіки за статусом агента) | N/A |
| G4 | не тестовано (мобільний viewport) | не виконано |
| G5 | E2E з реальним CDP — не виконано (та сама причина: сесія обірвалась) | не виконано |
| G6 | `bash bin/ui_verify.sh` | **PASS** exit 0 (0 HEX, 4 style{{ ≤17, усі файли ≤250 рядків) |
| G7 | `bash bin/deploy_verify.sh` — **не виконано в цій сесії** (код не задеплоєний, живе на .234 незакомічено до цього моменту) | не виконано |

## Обмеження цього прогону

AGY-сесія на .234 вичерпала внутрішній `--print-timeout` (агент явно встановив 22хв,
але робота — npm install нових test-залежностей (vitest/testing-library/jsdom) +
діагностика + фікс 13 файлів + написання тесту — забрала більше часу, ніж лишилось
до внутрішнього ліміту CLI) і завершилась з `Error: timeout waiting for response`
**до коміту**. Claude (координатор) перевірив diff незалежно (прочитав кожен файл,
підтвердив корінь причини напряму в `.d.ts` файлі бібліотеки, перезапустив тест
сам — 3/3 PASS, перезапустив `ui_verify.sh` сам — PASS) і закомітив від імені сесії.

Ручні браузерні гейти (G2-G5, G7) не виконані — потребують окремого живого прогону
з деплоєм на dev-184, не зробленого в межах цього виправлення.
