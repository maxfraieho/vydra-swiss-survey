# 📋 ПЛАН РЕАЛІЗАЦІЇ ПОКРАЩЕНЬ VYDRA SWISS SURVEY AGENT (P0–P5)

> **Документ:** Специфікація та План Реалізації (SDD Implementation Plan & Teaching Methodology)  
> **Проєкт:** `vydra-swiss-survey`  
> **Методологічна основа:** Specification-Driven Development (SDD), Human-in-the-Loop (HITL) Teaching & GitNexus Indexing  

---

## 🛠️ 1. МЕТОДОЛОГІЧНІ СТАНДАРТИ ТА ДИСЦИПЛІНА РОЗРОБКИ

### 📐 1.1 Специфікаційно-Орієнтований Підхід (SDD Workflow)
Для кожної з фаз P1–P5 неухильно дотримується процес SDD:

1. **Створення специфікації (Spec-first):** Перед написанням коду створюється окремий файл специфікації у директорії `specs/` (наприклад, `specs/P1-diacritics-normalization.md`). Файл описує вхідні/вихідні дані, інваріанти, граничні випадки (edge cases) та критерії прийняття за шаблоном `Given / When / Then`.
2. **Розробка через тести (Test-Driven Development - RED):** Тести створюються виключно на основі створеної специфікації ДО написання продуктивного коду. Тест-кейси обов'язково покривають усі перелічені edge cases.
3. **Реалізація коду (GREEN):** Продуктивний код пишеться виключно для доведення RED-тестів до зеленого стану (GREEN). Модифікація тестів під код категорично заборонена.
4. **Критерій завершеності фази:** Жодна фаза не вважається виконаною без закріпленого специфікаційного `.md` файлу у репозиторії.

### 🔍 1.2 Робота з індексом `gitnexus`
Перед початком та після завершення кожної фази здійснюється обов'язкове оновлення графового індексу кодової бази:

1. **Перед початком фази:** Виконується оновлення індексу `gitnexus` для забезпечення актуальної карти залежностей та символів.
2. **Використання контексту:** Пошук точок входу та рефакторингу виконується через `gitnexus`, мінімізуючи сліпе читання всього репозиторію.
3. **Після завершення фази:** Виконується повторне оновлення індексу `gitnexus`.
4. **Явна фіксація у звіті:** У фінальному звіті кожної фази обов'язково виводиться рядок:  
   `"gitnexus-індекс оновлено до/після: <коміт_хеш>"`.

---

## 🔍 2. ФАЗА 0: ВЕРИФІКАЦІЯ СТАНУ КОДОВОЇ БАЗИ (EMPIRICAL AUDIT)

Перш ніж проєктувати нові модулі, виконано аналіз реального коду у репозиторії. Результати верифікації проти 5 контрольних запитань:

| № | Запитання верифікації | Статус у коді | Висновок та рішення |
|---|---|---|---|
| **1** | Наявність `reflection._find_phrase()` та `test_cdp_diacritics_handling.py` | **Існує і сумісне (різні шари)** | `reflection._find_phrase()` здійснює високорівневу класифікацію результату опитування (`completed`/`disqualified`). DOM-пошук у `cdp_client.py` працює окремо. P1 додасть NFD-декомпозицію та умляут-мапінг у `cdp_client.py`, не ламаючи `reflection.py`. |
| **2** | Наявність `async_review_queue` | **Існує — НЕ створювати заново** | Таблиця `async_review_queue` вже існує в SQLite (`persona_graph_memory.py:180`), заповнюється при збоях (`record_run_trace`) та має API у `rules_api.py`. P2 розширить наявну чергу під UI, а не створюватиме паралельну чергу. |
| **3** | Стан таблиці `providers` та ізоляції за scope | **Існує в схемі, але ПОРОЖНЯ (0 записів)** | Таблиця `providers` створена у `persona_graph_memory.py:109`, але містить 0 записів. Застосовується базовий scope. P3 заповнить `providers` seed-даними та впровадит `structure_hash`. |
| **4** | Наявність інтеграції з Telegram | **Існує і сумісне** | Функції `get_telegram_bot_token()`, вебхуки та long-polling активні у `astryx_survey_server.py`. P5 додасть `notify_tutor_captcha_blocking()` через наявний токен бота (`sendMessage`). |
| **5** | Реальний гейт промоції правил (`N ≥ 3`) | **Існує, активний та покритий тестами** | Гейт `auto_promote_rules(min_unique_runs=3)` вже реалізовано у `persona_graph_memory.py:466` і закріплено у `test_tutor_activity_sdd.py`. Він залишається основними воротами промоції. |

---

## 🎯 3. ДЕТАЛЬНИЙ ПЛАН ПО ФАЗАХ (P1–P5)

---

### 🔤 ФАЗА P1: Діакритика та Семантична Нормалізація Тексту (Найвищий пріоритет)

* **Файл специфікації:** `specs/P1-diacritics-normalization.md`

#### 1. Зачіпані файли:
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (DOM-нормалізація та фаззі-пошук)
* [`tests/integration/test_cdp_diacritics_handling.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/tests/integration/test_cdp_diacritics_handling.py) (інтеграційні тести)

#### 2. Конкретні задачі:
* [ ] Створити специфікацію `specs/P1-diacritics-normalization.md` з описом правил NFD-нормалізації, умляут-мапінгу та застережень для коротких слів.
* [ ] Реалізувати у `cdp_client.py` функцію `normalize_survey_text(text: str) -> str` (`unicodedata.normalize('NFD')`, видалення діакрики, мапінг `ä`->`ae`, `ö`->`oe`, `ü`->`ue`, `ß`->`ss`).
* [ ] **Захист коротких слів (Guard on Short Tokens):** Для коротких токенів довжиною $\le 3$ символів (наприклад, `"oui"`, `"non"`, `"ja"`, `"nein"`) застосовувати виключно точний строгий збіг (Strict Equality). Фаззі-пошук Jaro-Winkler для коротких токенів вимикається або має поріг similarity $\ge 0.95$.
* [ ] Оновити `_FIND_JS` у `cdp_client.py` для виконання нормалізації як шуканого рядка (`needle`), так і текстів DOM-елементів.
* [ ] Чітко зафіксувати межу: `cdp_client.py` відповідає за таргетування елементів у DOM, а `reflection.py` — за класифікацію фінішного стану сторінки (`_find_phrase`). Модулі працюють як сумісні незалежні шари.

#### 3. Таблиця оцінки ризиків та плану відкату:

| Ризик | Ймовірність / Вплив | План запобігання / Відкату |
|---|---|---|
| Хибні спрацьовування Jaro-Winkler на коротких токенах (`ja` / `je`) | Середня / Високий | Строгий guard довжини $\le 3$ символів. Спочатку перевіряється exact match, далі NFD-нормалізація, і лише потім Jaro-Winkler. |
| Поломка існуючих тестів пошуку через нормалізацію | Низька / Середній | Відкат до оригінального `_FIND_JS` через конфігураційний прапорець `strict_text_mode`. |

#### 4. Критерій готовності (Definition of Done):
* `python3 -m pytest tests/integration/test_cdp_diacritics_handling.py` — **100% GREEN** для французьких (`intensité` = `intensite`) та німецьких (`Präferenz` = `Praeferenz`) еквівалентів.

---

### 🎓 ФАЗА P2: Зменшення Накладних Витрат Тутора (HITL Friction Reduction)

* **Файл специфікації:** `specs/P2-tutor-friction-reduction.md`

#### 1. Зачіпані файли:
* [`astryx_survey_server.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py) (передача метаданих Bounding Boxes)
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (збір DOM boundingClientRect з урахуванням прокрутки)
* [`web/src/screens/ops/SurveyOps.tsx`](file:///data/data/com.termux/files/home/vydra-swiss-survey/web/src/screens/ops/SurveyOps.tsx) (інтерактивний оверлей та панель `async_review_queue`)
* [`rules_api.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/rules_api.py) (розширення відображення `async_review_queue`)

#### 2. Конкретні задачі:
* [ ] Створити специфікацію `specs/P2-tutor-friction-reduction.md`.
* [ ] Розширити `cdp_client.py` збором координат елементів **відносно активного viewport скріншота** (`getBoundingClientRect()`), виключаючи приховані елементи (`width == 0` або `height == 0` або `display: none`).
* [ ] Передавати масив `bounding_boxes` у `/api/survey/verify_step`.
* [ ] Додати у `SurveyOps.tsx` SVG-компонент оверлею поверх скріншота. Клік по прямокутнику автоматично заповнює оверрайд.
* [ ] Додати випадаючий список підказок на основі `TOPIC_KEYWORDS`.
* [ ] **Інтеграція `async_review_queue` у UI:** Додати вкладку/секцію в `SurveyOps.tsx` для фільтрації сесій за статусом (`pending`, `reviewed`), перегляду кадрів збоїв та генерації правил у 1 клік.

#### 3. Таблиця оцінки ризиків та плану відкату:

| Ризик | Ймовірність / Вплив | План запобігання / Відкату |
|---|---|---|
| Зсув координат оверлею при прокручуванні сторінки (Scroll Offset) | Висока / Середній | Координати обчислюються відносно поточного екрана (viewport), а не всього документа `scrollHeight`. |
| Перевантаження DOM при передачі сотень прихованих елементів | Середня / Низька | Стрипити елементи з `width == 0` або `height == 0` ще на рівні JS-збірника у `cdp_client.py`. |

#### 4. Критерій готовності (Definition of Done):
* **Оверлей:** Клік по прямокутнику на скріншоті заповнює форму оверрайду за < 1 сек.
* **Черга:** Панель `async_review_queue` у `SurveyOps.tsx` дозволяє опрацювати провалений крок, змінити його статус у БД та створити правило без ручного введення SQL.

---

### 🛡️ ФАЗА P3: 4-Рівнева Ізоляція Правил та Seed-Мапінг Провайдерів

* **Файл специфікації:** `specs/P3-rule-isolation-providers.md`

#### 1. Зачіпані файли:
* [`persona_graph_memory.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py) (алгоритм `structure_hash` та 4-рівнева ієрархія)
* [`rules_api.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/rules_api.py) (CRUD та фільтрація scope)
* [`tests/unit/test_rules_engine.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/tests/unit/test_rules_engine.py) (юніт-тести)

#### 2. Конкретні задачі:
* [ ] Створити специфікацію `specs/P3-rule-isolation-providers.md`.
* [ ] Виконати seed-міграцію таблиці `providers` записом пріоритетних провайдерів (`Qualtrics`, `KeyResponses`, `Meinungsplatz`, `Decipher`, `Forsta`).
* [ ] **Алгоритм `structure_hash` (DOM Structural Skeleton Hash):**  
  Реалізувати обчислення SHA-256 хешу виключно на основі структури DOM-дерева без врахування текстового вмісту питань чи відповідей:
  ```python
  def compute_structure_hash(dom_elements: list[dict]) -> str:
      """Computes SHA-256 fingerprint of DOM structural layout.
      Uses tag names, element types, aria roles, and control counts.
      EXCLUDES all innerText, labels, and question/answer contents!
      """
      tokens = []
      for el in dom_elements:
          tag = el.get("tag", "").lower()
          el_type = el.get("type", "").lower()
          role = el.get("role", "").lower()
          tokens.append(f"{tag}:{el_type}:{role}")
      skeleton_str = "|".join(tokens)
      return hashlib.sha256(skeleton_str.encode("utf-8")).hexdigest()[:16]
  ```
* [ ] Впровадити 4-рівневу ієрархію вибору правил:  
  `1. EXACT_LAYOUT` (`host` + `provider_id` + `structure_hash`)  
  `2. PROVIDER_PATTERN` (`provider_id` + `pattern`)  
  `3. HOST_PATTERN` (`host` + `pattern`)  
  `4. GLOBAL_PATTERN` (`*` + `pattern`)

#### 3. Таблиця оцінки ризиків та плану відкату:

| Ризик | Ймовірність / Вплив | План запобігання / Відкату |
|---|---|---|
| Занадто точне узгодження `EXACT_LAYOUT` при зміні дрібних DIV-контейнерів | Висока / Високий | Фолбек-каскад: якщо `EXACT_LAYOUT` не знаходить збігу, система автоматично переходить до `PROVIDER_PATTERN` -> `HOST_PATTERN`. |
| Нерозпізнані провайдери (`provider_id IS NULL`) | Середня / Низька | Для невідомих провайдерів правило реєструється на рівні `HOST_PATTERN`. |

#### 4. Критерій готовності (Definition of Done):
* Правило, створене для хоста `meinungsplatz.ch` під конкретний макет (`EXACT_LAYOUT`), автоматично ігнорується на бланку іншого типу того ж хоста і не псує його проходження.

---

### 🧠 ФАЗА P4: Zero-Hallucination CoT Промпт для Vision Моделі

* **Файл специфікації:** `specs/P4-vision-cot-prompting.md`

#### 1. Зачіпані файли:
* [`vision.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/vision.py) (системний промпт та бенчмарк-тести)

#### 2. Конкретні задачі:
* [ ] Створити специфікацію `specs/P4-vision-cot-prompting.md`.
* [ ] Оновити системний промпт у `vision.py` з обов'язковим Chain-of-Thought міркуванням:  
  `visual_analysis` -> `persona_matching` -> `decision`.
* [ ] Додати жорстку заборону вигадування піксельних координат.
* [ ] **Розширений критерій прийняття (Ground-Truth Benchmark Matching):**  
  Створити еталонний набір із 10 скріншотів екранних форматок опитувань з відомими правильними відповідями (Ground Truth).

#### 3. Таблиця оцінки ризиків та плану відкату:

| Ризик | Ймовірність / Вплив | План запобігання / Відкату |
|---|---|---|
| Модель повертає валідний JSON, але робить неправильне за змістом рішення | Середня / Високий | Обов'язкова перевірка дій проти Ground Truth бенчмарку (DoD). |
| Збільшення часу відповіді моделі через довгий CoT | Низька / Середній | Обмеження CoT-міркування до 2 коротких речень у системній інструкції. |

#### 4. Критерій готовності (Definition of Done):
* **Формат:** 100% відповідей `vision.py` валідуються як коректний JSON.
* **Точність:** Дії моделі на 10 еталонних бенчмарк-кадрах на 100% відповідають Ground Truth рішенням.

---

### 🚑 ФАЗА P5: Самолікування та Сповіщення про Блокування (Self-Healing & Resilience)

* **Файл специфікації:** `specs/P5-self-healing-resilience.md`

#### 1. Зачіпані файли:
* [`cdp_client.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/cdp_client.py) (детекція сигнатур капчі та логування)
* [`astryx_survey_server.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/astryx_survey_server.py) (`notify_tutor_captcha_blocking`)
* [`survey_agent.py`](file:///data/data/com.termux/files/home/vydra-swiss-survey/survey_agent.py) (підтримка CLI-прапорця `--no-recovery` та лог недетектованих капч)

#### 2. Конкретні задачі:
* [ ] Створити специфікацію `specs/P5-self-healing-resilience.md`.
* [ ] Впровадити детекцію екранних капч у `cdp_client.py` за сигнатурами (`cf-turnstile`, `g-recaptcha`, `hcaptcha`, `geetest`).
* [ ] **Моніторинг недетектованих капч:** Якщо дія провалилася одразу після переходу на новий URL без відомих сигнатур капчі, реєструвати попередження у лог:  
  `"⚠️ Можлива недетектована капча або блокування на сторінці {url}"`.
* [ ] **Збереження CLI-прапорця `--no-recovery`:** Прапорець `--no-recovery` залишається у `survey_agent.py` для автономних пакетних прогонів без участі тутора (якщо прапорець передано, сесія зупиняється без очікування тутора).
* [ ] Додати `notify_tutor_captcha_blocking()` з надсиланням Push у Telegram.

#### 3. Таблиця оцінки ризиків та плану відкату:

| Ризик | Ймовірність / Вплив | План запобігання / Відкату |
|---|---|---|
| Хибно-позитивні блокування при появі прихованих скриптів капчі | Середня / Середній | Перевірка видимості елемента капчі (`isVisible`) перед активацією паузи. |
| Безкінечне очікування тутора в повністю автономному режимі | Низька / Високий | Перевірка прапорця `--no-recovery`: у режимі no-recovery агент завершує роботу одразу. |

#### 4. Критерій готовності (Definition of Done):
* Поява Turnstile/reCAPTCHA надсилає сповіщення в Telegram, ставить сесію на паузу у стані `waiting_captcha` (якщо не передано `--no-recovery`), та пише лог-сигнал для розширення списку сигнатур.

---

## 🚫 4. ЯВНО ВИКЛЮЧЕНО ЗІ СКОУПУ (EXCLUDED SCOPE)

На основі SDD-аналізу та рев'ю виключено з реалізації наступні складові дослідження:

1. **Складні математичні формули впевненій оцінки (Wilson Score Lower Bound $\ge 0.70$, Beta-binomial decay $\lambda=0.05$, Entropy $H \le 0.35$):**  
   *Обґрунтування:* На вибірці з десятків правил і 2 персон складність формул зі стелі не виправдана. Працюючий гейт $N \ge 3$ унікальних прогонів залишається єдиним стандартом.
2. **Створення нової паралельної черги `review_queue`:**  
   *Обґрунтування:* У системі вже функціонує `async_review_queue`. Розширюємо її, а не дублюємо.
3. **Прямі деплої на `dev-184` під час розробки:**  
   *Обґрунтування:* Дотримуємося 100% локальної розробки у Termux.
