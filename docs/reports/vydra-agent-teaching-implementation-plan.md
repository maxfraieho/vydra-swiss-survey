# 📋 ПЛАН РЕАЛІЗАЦІЇ ПОКРАЩЕНЬ VYDRA SWISS SURVEY AGENT (P0–P5)

> **Документ:** Специфікація та План Реалізації (SDD Implementation Plan)  
> **Проєкт:** `vydra-swiss-survey`  
> **Базова методологія:** Specification-Driven Development (SDD) & Human-in-the-Loop Teaching  

---

## 🔍 ФАЗА 0: ВЕРИФІКАЦІЯ СТАНУ КОДОВОЇ БАЗИ (EMPIRICAL AUDIT)

Перш ніж проєктувати нові модулі, виконано аналіз реального коду у репозиторії. Результати верифікації проти 5 контрольних запитань:

| № | Запитання верифікації | Статус у коді | Висновок та рішення |
|---|---|---|---|
| **1** | Наявність `reflection._find_phrase()` та `test_cdp_diacritics_handling.py` | **Існує і сумісне (різні шари)** | `reflection._find_phrase()` здійснює високорівневу класифікацію результату опитування (`completed`/`disqualified`). DOM-пошук у `cdp_client.py` працює окремо. P1 додасть NFD-декомпозицію та умляут-мапінг безпосередньо у `cdp_client.py`, не ламаючи `reflection.py`. |
| **2** | Наявність `async_review_queue` | **Існує — НЕ створювати заново** | Таблиця `async_review_queue` вже існує в SQLite (`persona_graph_memory.py:180`), заповнюється при збоях (`record_run_trace`) та має API у `rules_api.py`. P2 розширить наявну чергу під UI, а не створюватиме паралельну `review_queue`. |
| **3** | Стан таблиці `providers` та ізоляції за scope | **Існує в схемі, але ПОРОЖНЯ (0 записів)** | Таблиця `providers` створена у `persona_graph_memory.py:109`, але містить 0 записів. Застосовується базовий scope. P3 заповнить `providers` seed-даними та впровадить `structure_hash`. |
| **4** | Наявність інтеграції з Telegram | **Існує і сумісне** | Функції `get_telegram_bot_token()`, вебхуки та long-polling активні у `astryx_survey_server.py`. P5 додасть `notify_tutor_captcha_blocking()` через наявний токен бота (`sendMessage`). |
| **5** | Реальний гейт промоції правил (`N ≥ 3`) | **Існує, активний та покритий тестами** | Гейт `auto_promote_rules(min_unique_runs=3)` вже реалізовано у `persona_graph_memory.py:466` і закріплено у `test_tutor_activity_sdd.py`. Він залишається основними воротами промоції. |

---

## 🎯 ДЕТАЛЬНИЙ ПЛАН ПО ФАЗАХ (P1–P5)

---

### 🔤 ФАЗА P1: Діакритика та Семантична Нормалізація Тексту (Найвищий пріоритет)

#### 1. Зачіпані файли:
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (модуль пошуку елементів у DOM)
* [`tests/integration/test_cdp_diacritics_handling.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/tests/integration/test_cdp_diacritics_handling.py) (інтеграційні тести)

#### 2. Конкретні задачі:
* [ ] Додати у `cdp_client.py` функцію NFD-нормалізації `normalize_survey_text(text: str) -> str` із видаленням диакритичних символів (`unicodedata.normalize('NFD')`) та мапінгом німецьких умляут-комбінацій (`ä` -> `ae`, `ö` -> `oe`, `ü` -> `ue`, `ß` -> `ss`).
* [ ] Оновити скрипт `_FIND_JS` у `cdp_client.py` для виконання нормалізації тексту як шуканого шуканого рядка (`needle`), так і текстів DOM-елементів (`textOf(el)`).
* [ ] Інтегрувати алгоритм відстані Левенштейна / Jaro-Winkler для фолбек-пошуку елементів з описками або варіаціями відмінків.
* [ ] Розширити сюїт `test_cdp_diacritics_handling.py` перевіркою французьких (`intensité` = `intensite`) та німецьких (`Präferenz` = `Praeferenz`) варіацій.

#### 3. Залежність від Фази 0:
* Спирається на висновок п.1 Фази 0: нормалізація реалізується всередині `cdp_client.py`, не зачіпаючи логіку `reflection._find_phrase()`.

#### 4. Ризики та план відкату:
* *Ризик:* Хибне збігання коротких слів (наприклад, `ja` та `je`).
* *План відкату:* Збереження пріоритету строгого збігу тексту (Strict Match) перед викликом нормалізованого та фаззі-пошуку.

#### 5. Критерій готовності (Definition of Done):
* `python3 -m pytest tests/integration/test_cdp_diacritics_handling.py` — 100% GREEN для французьких та німецьких еквівалентів.

---

### 🎓 ФАЗА P2: Зменшення Накладних Витрат Тутора (HITL Friction Reduction)

#### 1. Зачіпані файли:
* [`astryx_survey_server.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py) (передача метаданих Bounding Boxes у `verify_step`)
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (збір DOM boundingClientRect)
* [`web/src/screens/ops/SurveyOps.tsx`](file:///data/data/com.termux/files/home/vydra-swiss-survey/web/src/screens/ops/SurveyOps.tsx) (інтерактивний оверлей та аналіз підказок)
* [`rules_api.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/rules_api.py) (розширення відображення `async_review_queue`)

#### 2. Конкретні задачі:
* [ ] Розширити `cdp_client.py` викликом JS-скрипта збору інтерактивних елементів (`button`, `input`, `label`, `select`) з їхніми відносними координатами у % (`x`, `y`, `width`, `height`).
* [ ] Передавати масив `bounding_boxes` через `/api/survey/verify_step` у `ACTIVE_SURVEY_STATE`.
* [ ] Додати у `SurveyOps.tsx` SVG-компонент оверлею поверх скріншота. При кліку на прямокутник елемента значення `override_target` та `override_action` заповнюються автоматично.
* [ ] Додати випадаючий список підказок поведінки на основі виявленого патерну з `TOPIC_KEYWORDS` (куріння, дохід, виключення за сферою діяльності).
* [ ] Інтегрувати наявну чергу `async_review_queue` у консоль `SurveyOps.tsx` для опрацювання незавершених сесій в 1 клік.

#### 3. Залежність від Фази 0:
* Спирається на висновок п.2 Фази 0: використання наявної таблиці `async_review_queue` без створення нової.

#### 4. Ризики та план відкату:
* *Ризик:* Зсув координат оверлею при масштабуванні зображення на мобільних пристроях.
* *План відкату:* Використання відносних відсоткових координат (`%`) замість абсолютних пікселів.

#### 5. Критерій готовності (Definition of Done):
* Клік по прямокутнику на оверлеї `SurveyOps.tsx` заповнює форму оверрайду за < 1 секунду без введення тексту вручну.

---

### 🛡️ ФАЗА P3: 4-Рівнева Ізоляція Правил та Seed-Мапінг Провайдерів

#### 1. Зачіпані файли:
* [`persona_graph_memory.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py) (структура записів, `structure_hash` та ієрархія пошуку)
* [`rules_api.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/rules_api.py) (фільтрація правил за scope)
* [`tests/unit/test_rules_engine.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/tests/unit/test_rules_engine.py) (юніт-тести ієрархії)

#### 2. Конкретні задачі:
* [ ] Виконати seed-міграцію таблиці `providers` записом відомих опитувальних платформ (`Qualtrics`, `KeyResponses`, `Meinungsplatz`, `Decipher`).
* [ ] Реалізувати обчислення `structure_hash` (SHA-256 хеш макету DOM-елементів сторінки) для ідентифікації конкретних бланкових форм.
* [ ] Впровадити 4-рівневу ієрархію вибору правил:  
  `1. EXACT_LAYOUT` (`host` + `provider_id` + `structure_hash`)  
  `2. PROVIDER_PATTERN` (`provider_id` + `pattern`)  
  `3. HOST_PATTERN` (`host` + `pattern`)  
  `4. GLOBAL_PATTERN` (`*` + `pattern`)
* [ ] Автоматично призначати рівень `EXACT_LAYOUT` для нових оверрайдів людина-тутор з подальшим розширенням після верифікації.

#### 3. Залежність від Фази 0:
* Спирається на висновок п.3 та п.5 Фази 0: збереження перевіреного гейту `N ≥ 3` без ускладнення некорисованими математичними формулами.

#### 4. Ризики та план відкату:
* *Ризик:* Занадто точкове застосування правил через відмінності в `structure_hash` динамічних форм.
* *План відкату:* Автоматичний фолбек на рівень `HOST_PATTERN`, якщо `EXACT_LAYOUT` не дав результату.

#### 5. Критерій готовності (Definition of Done):
* Правило, створене для хоста `meinungsplatz.ch` під конкретний макет, не застосовується до іншого опитування цього ж хоста без підтвердження.

---

### 🧠 ФАЗА P4: Zero-Hallucination CoT Промпт для Vision Моделі

#### 1. Зачіпані файли:
* [`vision.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/vision.py) (системний промпт для Gemma 3 4B Vision)

#### 2. Конкретні задачі:
* [ ] Оновити системний промпт у `vision.py` на структуру з обов'язковим Chain-of-Thought міркуванням:  
  `visual_analysis` -> `persona_matching` -> `decision`.
* [ ] Додати жорстку вимогу повернення JSON без довільного супроводжувального тексту.
* [ ] Впровадити заборону вигадування піксельних координат (використання тільки текстових міток та атрибутів).

#### 3. Залежність від Фази 0:
* Незалежна фаза, покращує якість первинного вибору дій візуальною моделлю.

#### 4. Ризики та план відкату:
* *Ризик:* Збільшення часу генерації відповіді моделлю через CoT міркування.
* *План відкату:* Обмеження довжини CoT міркувань до 2 речень у промпті.

#### 5. Критерій готовності (Definition of Done):
* 100% відповідей `vision.py` валідуються як коректний JSON із полями `visual_analysis`, `persona_matching`, `action`, `target_text`.

---

### 🚑 ФАЗА P5: Самолікування та Сповіщення про Блокування (Self-Healing & Resilience)

#### 1. Зачіпані файли:
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (пошук ознак капчі)
* [`astryx_survey_server.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py) (функція `notify_tutor_captcha_blocking`)
* [`survey_agent.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/survey_agent.py) (обробка стану `waiting_captcha`)

#### 2. Конкретні задачі:
* [ ] Впровадити детекцію екранних капч у `cdp_client.py` за маркерними підрядками (`cf-turnstile`, `g-recaptcha`, `hcaptcha`, `geetest`).
* [ ] Додати у `astryx_survey_server.py` функцію `notify_tutor_captcha_blocking(profile, url)` із надсиланням Push-сповіщення тутору через Telegram Bot API (`sendMessage`).
* [ ] При виявленні капчі переводити стан опитування у `waiting_captcha` із зупинкою таймера безпеки, даючи тутору час пройти капчу вручну через браузер.

#### 3. Залежність від Фази 0:
* Спирається на висновок п.4 Фази 0: використання наявної інтеграції з Telegram бота `meinungsplatzworkflow_bot`.

#### 4. Ризики та план відкату:
* *Ризик:* Хибно-позитивні спрацьовування на приховані скрипти капч.
* *План відкату:* Перевірка видимості елемента капчі (`isVisible`) перед активацією блокування.

#### 5. Критерій готовності (Definition of Done):
* Поява Turnstile/reCAPTCHA надсилає сповіщення в Telegram та ставить сесію на паузу без закриття вкладки.

---

## 🚫 ЯВНО ВИКЛЮЧЕНО ЗІ СКОУПУ (EXCLUDED SCOPE)

На основі вимог SDD та рев'ю виключено з реалізації наступні складові дослідження:

1. **Складні математичні формули впевненій оцінки (Wilson Score Lower Bound, Bayesian Time Decay, Entropy Thresholds):**  
   *Обґрунтування:* На вибірці з десятків правил і 2 персон впровадження формул Вілсона ($z=1.96$), ентропії Шеннона ($H \le 0.35$) та часового згасання ($\lambda=0.05$/день) є надлишковою математизацією без емпіричного підтвердження. Наявний робочий гейт $N \ge 3$ унікальних прогонів повністю забезпечує надійність.
2. **Створення нової паралельної черги `review_queue`:**  
   *Обґрунтування:* У системі вже функціонує `async_review_queue`. Створення нової черги призведе до дублювання даних.
3. **Прямі деплої на `dev-184` під час розробки:**  
   *Обґрунтування:* Згідно з директивою користувача, увесь деплой та виконання збірок здійснюються на 100% локально у Termux.
