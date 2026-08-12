# 🎓 МЕТОДИКА НАВЧАННЯ АГЕНТА VYDRA SWISS SURVEY (HITL + SDD)

> **Статус:** Повністю реалізовано та верифіковано (SDD Фази P0–P5, 33/33 тестів GREEN)  
> **Коміт синхронізації:** `8d843e0`  
> **Авторитетний контекст:** [`docs/reports/vydra-agent-teaching-implementation-plan.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/docs/reports/vydra-agent-teaching-implementation-plan.md), [`specs/`](file:///data/data/com.termux/files/home/vydra-swiss-survey/specs/)  

---

## 🚀 1. ОСНОВНА ІДЕЯ МЕТОДИКИ НАВЧАННЯ

Методика навчання агента `Vydra Swiss Survey` поєднує **Human-in-the-Loop (HITL) інтерактивний оверрайд**, **4-рівневу ієрархію ізоляції правил** та **емпіричний гейт промоції ($N \ge 3$)**.

Цикл навчання забезпечує перетворення разової корекції тутора-людини на надійне формальне правило системи без побічних ефектів для інших опитувальних сайтів.

---

## 👥 2. ТРИ УЧАСНИКИ ТА ЇХНІ РОЛІ

| Учасник | Роль та швидкість | Зони відповідальності |
|---|---|---|
| **Агент (Gemma 3 4B Vision / CDP Client)** | Секунди — гарячий шлях | Виконує кроки у браузері, здійснює NFD-нормалізацію диакритики, обчислює `structure_hash`, застосовує 4-рівневий scope rules, формує CoT-міркування та надсилає Telegram Push у разі капчі. |
| **Тутор-Людина (Q / Operator)** | Живий прогін та асинхронний опрацювання | Здійснює 1-клік оверрайд через SVG-оверлей у `SurveyOps.tsx`, затверджує правила з черги `async_review_queue`, отримує Push-сповіщення у Telegram. |
| **Асистент (AntiGravity / Claude / Agy)** | Асинхронно — хвилини | Формалізує оверрайди тутора у SDD специфікації (`specs/P*-*.md`), виконує TDD розробку (RED/GREEN), оновлює графовий індекс `gitnexus` та проводить санітарні перевірки БД. |

---

## 🏛️ 3. КЛЮЧОВІ ІНВАРІАНТИ НАВЧАННЯ (P1–P5)

### 🔤 P1. Нормалізація Тексту та Захист Коротких Токенів
1. **NFD-декомпозиція та умляут-мапінг:** Всі тексти елементів та шукані рядки нормалізуються через `normalize_survey_text()` (`ä`$\rightarrow$`ae`, `ö`$\rightarrow$`oe`, `ü`$\rightarrow$`ue`, `ß`$\rightarrow$`ss`, `intensité`$\rightarrow$`intensite`).
2. **Guard на токени $\le 3$ символів:** Для слів довжиною $\le 3$ символів (наприклад `"oui"`, `"non"`, `"ja"`, `"nein"`) фаззи-пошук Jaro-Winkler **вимкнений**. Застосовується виключно точний збіг (Strict Match).
3. **Розділення шарів:** DOM-таргетування виконується у `cdp_client.py`, а класифікація результату опитування (`_find_phrase`) — у `reflection.py`.

### 🎓 P2. Зменшення Накладних Витрат Тутора (HITL Friction)
1. **Viewport Relative Bounding Boxes:** `cdp_client.py` повертає відносні відсоткові координати (`x`, `y`, `width`, `height` у %) для інтерактивних елементів екрана.
2. **1-Клік SVG-Оверлей:** Натискання на прямокутник у `SurveyOps.tsx` заповнює оверрайд менше ніж за 1 секунду.
3. **Черга `async_review_queue`:** Провалені прогони опрацьовуються тутором у UI без прямого виконання SQL.

### 🛡️ P3. 4-Рівнева Ізоляція Правил та DOM Skeleton Hash
1. **Seed-Мапінг Провайдерів:** В базі зафіксовані ключові платформи (`Qualtrics`, `KeyResponses`, `Meinungsplatz`, `Decipher`, `Forsta`).
2. **Структурний Хеш (`structure_hash`):** SHA-256 хеш обчислюється з тегів, типів атрибутів та aria-ролей **БЕЗ ТЕКСТІВ ПИТАНЬ ТА ВІДПОВІДЕЙ**.
3. **4-Рівнева Ірархія Scope:**
   1. `EXACT_LAYOUT` (`host` + `provider_id` + `structure_hash`)
   2. `PROVIDER_PATTERN` (`provider_id` + `pattern`)
   3. `HOST_PATTERN` (`host` + `pattern`)
   4. `GLOBAL_PATTERN` (`*` + `pattern`)

### 🧠 P4. Zero-Hallucination Vision CoT Промпт
1. **Структура CoT JSON:**
   ```json
   {
     "visual_analysis": "Короткий CoT аналіз елементів сторінки",
     "persona_matching": "Узгодженість рішення з профілем персони",
     "action": "click" | "type" | "scroll" | "done",
     "target_text": "ТОЧНИЙ ВІДИМИЙ ТЕКСТ (ЗАБОРОНЕНО ВИГАДУВАТИ ПІКСЕЛЬНІ КООРДИНАТИ)",
     "value": "значення для введення"
   }
   ```
2. **Ground-Truth Benchmark:** Всі зміни промпту проходять 10 еталонних тест-кейсів у `test_vision_cot_benchmark.py`.

### 🚑 P5. Самолікування та Сповіщення у Telegram
1. **Детекція Капчі:** Маркери `cf-turnstile`, `g-recaptcha`, `hcaptcha`, `geetest` переводять опитування у стан `waiting_captcha`.
2. **Telegram Push:** Сповіщення надсилаються у Telegram-групу через бота `@vydra_swiss_survey_bot` та `notify_tutor_captcha_blocking()`.
3. **Прапорець `--no-recovery`:** У повністю автономному режимі з прапорцем `--no-recovery` сесія завершується одразу без очікування тутора.

---

## 🔁 4. ЖИТТЄВИЙ ЦИКЛ ПРАВИЛА (FROM SHADOW TO ACTIVE)

```
[ Повідомлення / Оверрайд ] ➔ status='shadow', wins=0, losses=0
                                    │
                                    ▼ (Наступні прогони)
                        bump_rule_outcome(rule_id, outcome)
                                    │
                                    ▼
                  N >= 3 Унікальних Завершених Прогонів?
                      ├── НІ  ➔ Залишається status='shadow'
                      └── ТАК ➔ auto_promote_rules() ➔ status='active'
```
