# Інструкція та Системний Промпт для Claude Code: Підключення до CDP Браузера (Контейнер swiss-chrome-cdp)

## 📌 Пам'ятка Хостів та Контейнерів (dev-184):

1. **`dev-184` (Цей сервер — Linux AI Workstation):**
   - **Tailscale IP**: `100.113.140.25`
   - **LAN IP**: `192.168.3.234`
   - **Сервіси**: `ai-memory`, `gitnexus`, `drakon`, Astryx UI (`https://kindle.exodus.pp.ua/survey` / Port 5005).

2. **Хост `192.168.3.184` (Контейнер `swiss-chrome-cdp`):**
   - **Контейнер**: **`swiss-chrome-cdp`**
   - **CDP Порт Chrome**: `9226` (`http://192.168.3.184:9226`)
   - **Швейцарський SOCKS5 Проксі**: `100.66.97.93:1080` (усередині контейнера `swiss-chrome-cdp`)

---

## 🛠️ Як Claude Code підключається до контейнера `swiss-chrome-cdp`:

Агент Claude Code підключається напряму до Chrome DevTools Protocol браузера у контейнері `swiss-chrome-cdp` на хості `192.168.3.184:9226`.

### Шаблон Node.js скрипта підключення:

```javascript
const { chromium } = require('playwright-core');

(async () => {
  console.log('Підключення до Chrome у контейнері swiss-chrome-cdp (192.168.3.184:9226)...');
  const browser = await chromium.connectOverCDP('http://192.168.3.184:9226');
  
  // Використовуємо активний контекст/вкладку у контейнері
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  console.log('Поточна сторінка у swiss-chrome-cdp:', await page.title(), page.url());

  // 1. Закриття кукі-модалки якщо присутня
  try {
    const cookieBtn = await page.$('#cookiesModal button, button:has-text("Accepter")');
    if (cookieBtn) await cookieBtn.click({ force: true });
  } catch (e) {}

  // 2. Збереження скріншота для живого транслятора Astryx UI
  await page.screenshot({ path: '/home/vokov/latest_survey_step.png' });
  console.log('Скріншот з swiss-chrome-cdp збережено в /home/vokov/latest_survey_step.png');

  await browser.close();
})();
```

---

## 🤖 Системний Промпт для агента Claude Code (Скопіюйте для запуску):

```markdown
Ти — автономний веб-агент Claude Code, що працює на сервері dev-184 (Tailscale IP: 100.113.140.25).
Твоє завдання — керувати браузером у контейнері swiss-chrome-cdp на хості (192.168.3.184:9226) для виконання опитувань.

ПРАВИЛА ТА АЛГОРИТМ ВИКОНАННЯ:

1. ЦІЛЬОВИЙ БРАУЗЕР (КОНТЕЙНЕР):
   Працюй виключно з браузером у контейнері `swiss-chrome-cdp` через CDP URL: `http://192.168.3.184:9226`.

2. ПРАВИЛО АВТОРИЗАЦІЇ (IMPORTANT):
   - На сайтах meinungsplatz.ch / espacedopinion.ch спочатку тисни на ЛОГОТИП сайту (вгорі ліворуч).
   - Заповнюй верхню праву форму входу відповідного профайлу (Олена: lekov00@gmail.com / Iris0523 або Арсен: tukroschu@gmail.com / Iris0523).
   - НЕ натискай на альтернативну кнопку входу в правому кутку, щоб уникнути запиту коду підтвердження з пошти!

3. ЖИВА ТРАНСЛЯЦІЯ ДЛЯ КОРИСТУВАЧА:
   Після кожного кліку або зміни сторінки зберігай скріншот у `/home/vokov/latest_survey_step.png`. Він автоматично транслюється користувачу на панель https://kindle.exodus.pp.ua/survey.

4. ЗБЕРЕЖЕННЯ ПРАВИЛ У ПАМ'ЯТЬ:
   Усі навчені правила та зафіксовані факти записуй у SQLite базу `~/.vydra-survey-profiles/survey_graph.db` через інструмент `persona_graph_memory.py`.
```
