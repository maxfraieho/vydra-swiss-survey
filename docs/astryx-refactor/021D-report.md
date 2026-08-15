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
| G2 | live CDP на `https://survey.exodus.pp.ua/ops` після деплою: реальні `Input.dispatchKeyEvent` (не JS-присвоєння) в поле URL | **PASS** — введений текст `https://meinungsplatz.ch/survey/g2-live-test` точно збігся зі значенням поля, кнопка «Продовжити» стала активною (`disabled: false`) |
| G3 | не тестовано окремо (компонент не має власної блокуючої логіки за статусом агента) | N/A |
| G4 | не тестовано (мобільний viewport) | не виконано |
| G5 | E2E з реальним CDP — часткове покриття через G2 (клавіатурний ввід+валідація+активація кнопки на живому проді); повний потік до кроку `resume` в таймлайні окремо не знятий | частково |
| G6 | `bash bin/ui_verify.sh` | **PASS** exit 0 (0 HEX, 4 style{{ ≤17, усі файли ≤250 рядків) |
| G7 | `bash bin/deploy_verify.sh https://survey.exodus.pp.ua` після деплою (build `index-BjElCRoN.js`) | **PASS** exit 0; `bash bin/ops_verify.sh` теж exit 0 (Telegram queue/resume-attach/auth-gate без регресій) |

## Обмеження цього прогону

AGY-сесія на .234 вичерпала внутрішній `--print-timeout` (агент явно встановив 22хв,
але робота — npm install нових test-залежностей (vitest/testing-library/jsdom) +
діагностика + фікс 13 файлів + написання тесту — забрала більше часу, ніж лишилось
до внутрішнього ліміту CLI) і завершилась з `Error: timeout waiting for response`
**до коміту**. Claude (координатор) перевірив diff незалежно (прочитав кожен файл,
підтвердив корінь причини напряму в `.d.ts` файлі бібліотеки, перезапустив тест
сам — 3/3 PASS, перезапустив `ui_verify.sh` сам — PASS), закомітив від імені сесії,
змержив з паралельним Feature 022 (без конфліктів — різні файли), задеплоїв на
dev-184 і підтвердив G2/G7 живо через CDP на проді.

Не виконано: G4 (мобільний viewport 390×844), повний E2E-таймлайн-крок `resume` (G5,
частково закрито через G2).
