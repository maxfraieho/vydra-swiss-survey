# Звіт про верифікацію деплою (Prompt 020C — Deploy Truth)

**Дата:** 2026-08-15  
**Цільовий хост/URL:** `https://survey.exodus.pp.ua` (бек / Flask на `192.168.3.184:5005`, браузер Comet на `192.168.3.30:9226`)  
**Гілка:** `astryx-ui-refactor`  
**Задеплоєний бандл:** `assets/index-DalGzCm2.js`  
**Статус верифікації:** **PASS (Усі машинно перевірені гейти пройдено)**

---

## 1. Таблиця верифікації вимог 020C

| № | Пункт перевірки | Команда перевірки | Отриманий вивід | Файл Evidence | Статус |
|---|---|---|---|---|---|
| 1 | **Фіксація початкової розбіжності source↔deploy** | `diff <(git show HEAD:web/src/main.tsx) <(curl -s https://survey.exodus.pp.ua/)` | Зафіксовано розрив: роутер мав 9 шляхів, бандл не містив токенів 020 | [`00-wiring-gap.txt`](./00-wiring-gap.txt) | **PASS** |
| 2 | **Полагодження роутера (≤ 6 пунктів навігації)** | `node bin/dom_probe.mjs https://survey.exodus.pp.ua` | `navCount: 5`, hrefs: `['/ops', '/traces', '/rules', '/report', '/settings']` | [`11-dom-probe.json`](./11-dom-probe.json) | **PASS** |
| 3 | **Редирект `/gate` → `/settings?tab=hosts`** | `node bin/dom_probe.mjs https://survey.exodus.pp.ua` | `gateRedirectOk: true`, `finalGateUrl: "/settings?tab=hosts"` | [`11-dom-probe.json`](./11-dom-probe.json) | **PASS** |
| 4 | **Наявність токенів 020 у живому бандлі** | `grep -o -F "view=fullscreen" /tmp/bundle.js` & `grep -o -F "reason_code"` | `bundle:view=fullscreen=1`<br>`bundle:reason_code=2` | [`10-bundle-tokens.txt`](./10-bundle-tokens.txt) | **PASS** |
| 5 | **Перемикання Viewport режимів (/ops?view=fullscreen)** | `node bin/dom_probe.mjs https://survey.exodus.pp.ua` | `fullscreenDiff: true`, `hasFullscreenAttr: true` (`data-viewport-mode="fullscreen"`) | [`11-dom-probe.json`](./11-dom-probe.json), [`32-ops-fullscreen.png`](./32-ops-fullscreen.png) | **PASS** |
| 6 | **Мобільна адаптивність (390px, 0px горизонтального скролу)** | `node bin/dom_probe.mjs https://survey.exodus.pp.ua` | `overflowDiff: 0` для `/ops`, `/traces`, `/rules`, `/report`, `/settings` | [`11-dom-probe.json`](./11-dom-probe.json), [`33-ops-390.png`](./33-ops-390.png) | **PASS** |
| 7 | **Машинний UI-гейт інваріантів** | `bash bin/ui_verify.sh` | `🎉 ALL UI INVARIANTS PASS` (0 HEX, style={{ <= 40, max 250 рядків, 0 sub-12px) | [`20-ui_verify.txt`](./20-ui_verify.txt) | **PASS** |
| 8 | **Машинний гейт деплою на живому URL** | `bash bin/deploy_verify.sh https://survey.exodus.pp.ua` | `DOM Probe: PASS`<br>`🎉 DEPLOY VERIFICATION PASS` (код виходу `0`) | [`21-deploy_verify.txt`](./21-deploy_verify.txt) | **PASS** |
| 9 | **Унікальність скріншотів реального UI** | `sha256sum docs/astryx-refactor/evidence/020C/*.png` | 4 унікальних хеші для inline, focus, fullscreen, 390px | [`40-checksums.txt`](./40-checksums.txt) | **PASS** |

---

## 2. Контрольні суми скріншотів (sha256)

```text
f493b3e718b413e765178d654dc2691112dff759b191d3a3edbf441894457dc5  30-ops-inline.png
947343b0209e96332e119b319619eeaa5bdf0eab484020e4d2edc3eebb16da66  31-ops-focus.png
e6f2a435d293b5c11d79e4c999d649b11f641d480da47bd31b770fc635f0a29c  32-ops-fullscreen.png
2636e0afbdd441088a37737440759826ecad1e98f7def187405cf045e78c4b69  33-ops-390.png
```

---

## 3. Список файлів Evidence

- [`00-wiring-gap.txt`](./00-wiring-gap.txt) — опис первинного розриву між специфікацією 020 і старим бандлом;
- [`10-bundle-tokens.txt`](./10-bundle-tokens.txt) — підтвердження входження `view=fullscreen` та `reason_code` у live JS бандл;
- [`11-dom-probe.json`](./11-dom-probe.json) — повний JSON-лог автоматичного обстеження DOM через CDP на реальному браузері;
- [`20-ui_verify.txt`](./20-ui_verify.txt) — вивід локального статичного аналізу інваріантів;
- [`21-deploy_verify.txt`](./21-deploy_verify.txt) — вивід проходження гейту `bin/deploy_verify.sh`;
- [`30-ops-inline.png`](./30-ops-inline.png) — live скріншот сторінки операцій у звичайному (inline) режимі;
- [`31-ops-focus.png`](./31-ops-focus.png) — live скріншот сторінки операцій у режимі фокусу (`?view=focus`);
- [`32-ops-fullscreen.png`](./32-ops-fullscreen.png) — live скріншот сторінки операцій у повноекранному режимі (`?view=fullscreen`);
- [`33-ops-390.png`](./33-ops-390.png) — live скріншот мобільного вигляду (390px);
- [`40-checksums.txt`](./40-checksums.txt) — файл хешів для валідації.
