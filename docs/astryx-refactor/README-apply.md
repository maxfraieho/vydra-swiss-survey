# Astryx UI refactor — бандл для застосування

Готові файли й патчі до плану рефакторингу. Застосовувати у
`~/projects/vydra-swiss-survey`. Патчі описові (не `git apply`) — це вказівки
для точкових правок, бо контекст рядків у вас уже міг зсунутись.

## Що в бандлі

```
web/src/ui/tokens.ts            ← НОВИЙ, копіювати як є
web/src/ui/primitives.tsx       ← НОВИЙ, копіювати як є
web/src/shell/Nav.tsx           ← ЗАМІНА (нова IA + лічильник конфліктів)
patches/eslint.config.js.patch  ← A3 огорожа
patches/index.html.patch        ← B1
patches/StatusBar.tsx.patch     ← B + C3
patches/SettingsPage.tsx.patch  ← B + C5
patches/main.tsx.patch          ← C1 + C4
patches/SurveyOps-split.md      ← B2 (найбільший файл)
patches/RulesTable.tsx.patch    ← B3 + C4
patches/settings-panels.md      ← B4-B7, мапа замін по решті 17 файлів
```

## Порядок

```bash
cd ~/projects/vydra-swiss-survey
git checkout -b refactor/astryx-ui

# Етап A — примітиви + лінтер (борг перестає рости)
cp <бандл>/web/src/ui/tokens.ts       web/src/ui/tokens.ts
cp <бандл>/web/src/ui/primitives.tsx  web/src/ui/primitives.tsx
# застосувати patches/eslint.config.js.patch
cd web && npx tsc --noEmit && npx eslint src/ui   # примітиви мусять бути чисті
git commit -am "refactor(ui): add tokens + primitives layer, forbid inline colors"

# Етап B — по одному файлу за коміт, у порядку з patches/settings-panels.md
#   починати з index.html, далі SurveyOps (найбільший виграш)

# Етап C — IA
cp <бандл>/web/src/shell/Nav.tsx web/src/shell/Nav.tsx
# застосувати patches/main.tsx.patch, StatusBar.tsx.patch, SettingsPage.tsx.patch

# Етап D — перевірка
npm run theme:build && bash bin/build_web.sh
```

## Що треба перевірити ПЕРЕД етапом A

1. **Пропи Astryx-компонентів.** `primitives.tsx` спирається на API, які вже
   використані у вашому коді (`Card padding`, `MetadataList columns/label`,
   `Dialog isOpen/onOpenChange`, `Layout header` + `LayoutContent`,
   `Badge variant/label`, `SideNavItem endContent`). `endContent` у
   `SideNavItem` — єдине, що я НЕ бачив у вашому коді (є в `TopNav`), тож
   якщо TS поскаржиться — обгорнути бейдж у `label` як ReactNode або
   перевірити типи: `npx tsc --noEmit`.
2. **Ендпоінт `/api/rules/conflicts/count`.** У `rules_api.py` такого шляху
   немає — його треба або додати (`SELECT count(*)` по конфліктах), або в
   `Nav.tsx` замінити на вже наявний список конфліктів і брати `.length`.
   Це єдина серверна зміна в усьому плані.
3. **Токени кольорів.** `tokens.ts` використовує `--color-text-red/green/yellow`,
   `--color-text-secondary/tertiary`, `--color-background-muted/subtle` — усі
   вони вже трапляються у ваших TSX, тому в темі присутні. `--color-border-subtle`
   у `DataList` звірити з `theme/theme.css`; якщо назви немає — взяти
   `--color-border-emphasized` (використовується у StatusBar).

## Definition of Done (з плану)

```bash
rg -c "style=\{\{" web/src --stats                    # ≤ 40, усе geometry
rg "#[0-9a-fA-F]{6}" web/src --glob '!theme/**'        # нуль
npx astryx doctor                                      # без попереджень
rg -n "fontSize: '(9|10|11)px'" web/src                # нуль
```
Плюс скріншоти 390px усіх 8 маршрутів без горизонтального скролу.
