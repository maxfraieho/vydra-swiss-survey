# Словник патернів (`pattern-vocabulary`)

> Джерело правди для цього документа — `reflection.py` (`TOPIC_KEYWORDS`,
> `QUALIFYING_POLARITY`). Цей файл — людинозрозумілий знімок того, що вже
> існує в коді як `dict`, а не нова специфікація. Якщо код і цей документ
> розійдуться — вірити коду і оновити документ.

## Що таке "патерн"

Патерн — це тема анкетного питання, яку `detect_pattern()` розпізнає за
підрядком у перших ~600 символах тексту сторінки (мовонезалежно, ключові
слова для de/fr/it/en в одному списку). Розпізнаний патерн стає ключем
`host_rules.pattern` — тим, за чим правила групуються по хосту й персоні.

Якщо жодне ключове слово не збіглось — `detect_pattern()` повертає `None`,
і `reflect()` нічого не пише для цього кроку. Патерн ніколи не вигадується.

## 10 патернів і їхня кваліфікуюча полярність

Для кожного патерну `QUALIFYING_POLARITY` фіксує, яка відповідь
("affirm" — так/маю/користуюсь, "deny" — ні/не займаюсь,
"not_fully_healthy" — окремий стан для здоров'я) підвищує шанс пройти
скринінг. Це те, що self-reflection порівнює з фактично даною відповіддю,
коли прогін закінчився `disqualified`/`incomplete`/`error`.

| Патерн | Ключові слова (de/fr/it/en, скорочено) | Кваліфікуюча полярність | Сенс |
|---|---|---|---|
| `tobacco` | raucher, tabac, fumo, tobacco, cigarette, smoking, smoker | `affirm` | Курець/користувач тютюну — типовий screening-фільтр опитувань про звички. |
| `health_status` | gesundheit, santé, salute, health, krankheit, maladie | `not_fully_healthy` | Не повністю здоровий / має незначну проблему зі здоров'ям — частий критерій в опитуваннях про здоров'я. |
| `alcohol` | alkohol, alcool, alcohol | `affirm` | Вживає алкоголь. |
| `auto` | auto, voiture, macchina, car, fahrzeug | `affirm` | Має автомобіль / керує. |
| `finance` | finanz, finance, finanza | `affirm` | Стосується фінансових продуктів/рішень. |
| `income` | einkommen, revenu, reddito, income, salaire | `affirm` | Має дохід / працює. |
| `employment` | beruf, profession, professione, employment, job, arbeit | `affirm` | Працевлаштований. |
| `industry_exclusion` | marktforschung, étude de marché, ricerca di mercato, market research, werbung, publicité, advertising, journalismus, journalism | `deny` | **Завжди заперечно.** Стандартний screening-виняток: ніколи не визнавати роботу в маркетинговому дослідженні, рекламі чи медіа — це універсальне правило опитувань, не специфічне для хоста. |
| `household` | haushalt, ménage, famiglia, household | `affirm` | Стосується домогосподарства. |
| `shopping` | einkauf, achat, acquisto, shopping, purchase | `affirm` | Робить покупки в описаній категорії. |

Для `health_status` полярність `not_fully_healthy` у логіці порівняння
(`reflection.py`, `classify_outcome`/`reflect`) нормалізується до `deny`
при зіставленні з фактичною відповіддю — це єдиний патерн із власною
міткою замість простого affirm/deny.

## Як патерн стає правилом

1. `detect_pattern(page_text)` розпізнає патерн на кроці опитування.
2. Якщо прогін завершився неуспішно (`disqualified`/`incomplete`/`error`),
   `reflect()` порівнює очікувану `QUALIFYING_POLARITY` з тим, що фактично
   відповіла персона, і за розбіжності пише рядок у `host_rules` зі
   `status='shadow'`, `source='self_reflection'`.
3. Людина (через `update_host_rule`/UI, фаза U3 плану-додатку) або
   автоматичний гейт (`bump_rule_outcome`, фаза 6-8 основного плану)
   переводить правило в `active`.

`rules_report.py` (фаза U0) читає ці правила read-only й нічого в цей
ланцюг не додає — лише візуалізує накопичене.

## Інваріант: `behavior` — це текст, не код

`host_rules.behavior` **ніколи не інтерпретується як код**. Це проза, яку
конкатенують у промпт персони (Gemma читає її як інструкцію природною
мовою — так само, як seed-фрази в `migrate()`). Немає парсера, немає
`eval`, немає умовної логіки всередині `behavior` — рядок або присутній у
промпті персони, або ні.

Будь-яка майбутня пропозиція зробити правила виконуваними (умова→дія,
DSL, щось у стилі DRAKON-експорту з `agent_rules.yaml`) — це **окремий
план з окремим гейтом**, а не розширення поточної схеми. Обґрунтування
цього рішення (чому повний DRAKON round-trip зараз over-engineering) —
`docs/plan-ui-astryx-addendum.md`, розділ 3.

## Контрольований словник як API

Цей словник віддається програмно через `GET /api/rules/vocabulary` (фаза
U1 плану-додатку) — та сама пара `TOPIC_KEYWORDS`/`QUALIFYING_POLARITY` з
`reflection.py`, без дублювання. UI використовує його, щоб форма
створення правила пропонувала `<select>` зі списку патернів, а не вільний
текст (кастомний pattern залишається можливим, але з попередженням, що
`detect_pattern()` його не розпізнає автоматично).
