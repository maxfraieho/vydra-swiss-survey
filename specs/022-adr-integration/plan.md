# Plan — 022-adr-integration

> **Проєкт:** `vydra-swiss-survey`
> **Гілка:** `astryx-ui-refactor`
> **Тип:** Refactor методики (Шаблон 3) — реструктуризація процесу розробки,
> без зміни рантайм-поведінки продукту.
> **Статус:** Затверджено після Шаблону 7 — див. `clarify.md`. Рішення
> "без нового 10-го шаблону" підтверджено оператором.
> **Джерела:** deep research AGY .234 (open-web) + Gemini Pro/NotebookLM
> (блокнот `ADR_tool`), обидва незалежно збіглися — див. `clarify.md`.

---

## 0. Impact-аналіз (Крок 2 Шаблону 1)

GitNexus-індекс `vydra-swiss-survey` — 57 комітів позаду HEAD (відома,
не полагоджена цієї сесії проблема), `impact()` на `evaluate_diff` не
знайшов ціль через staleness. Заміна — прямий `find | grep` (BusyBox,
без `--include`):

| Символ | Викликається з | Ризик розширення |
|---|---|---|
| `evaluate_diff()` (`scripts/sdd_llm_judge.py`) | лише `.githooks/pre-commit` (subprocess) + `tests/unit/test_sdd_judge.py` | Низький — нема прямих імпортерів поза тестом |
| `build_briefing()` (`~/projects/resume/kindle_digest.py:62`) | лише `main()` того ж файлу (`:142`) | Низький — приватна функція модуля |

Жодних неочікуваних downstream-споживачів — розширення обох функцій
безпечне без зачіпання іншого коду.

---

## 1. Артефакти ADR (`clarify.md` п.1, 2, 3)

### 1.1 Дії
1. `docs/adr/template.md` — шаблон MADR v3.x (Title, Status, Context and
   Problem Statement, Decision Drivers, Considered Options з Pros/Cons,
   Decision Outcome, Consequences, YAML frontmatter: `status`, `date`,
   `deciders`, `spec`, `supersedes`/`superseded-by`).
2. `docs/adr/0001-baseline-architecture.md` — ретроактивний baseline
   (`clarify.md` п.7): Flask/Termux backend, SQLite WAL, прямий CDP замість
   Selenium, Astryx design system. `status: Accepted (Retroactive)`.
3. `docs/adr/0002-madr-format-adoption.md` — сам цей ADR (адопція MADR +
   наскрізна нумерація) — перший "живий" (не ретроактивний) запис,
   `spec: specs/022-adr-integration`.
4. НЕ встановлювати log4brains (`clarify.md` п.3) — чисті markdown-файли.

### 1.2 Acceptance
- `docs/adr/` існує, містить 3 файли вище.
- Обидва ADR валідні MADR (усі обов'язкові секції заповнені, не заглушки).

---

## 2. Конституція `.specify/constitution.md` §3 → нова §3.1 (`clarify.md` п.6)

### 2.1 Дії
Додати підрозділ "Критерій ADR-значущості" з явним чеклістом (5 пунктів з
`clarify.md`), і одне речення в правило пріоритету: ADR — джерело
кандидатів для майбутніх інваріантів, сам по собі не новий шар пріоритету
(конституція лишається найвищим шаром: конституція > методологія >
ADR-обґрунтування > транспорт).

### 2.2 Acceptance
- `git diff --stat .specify/constitution.md` показує лише додавання
  (append), жоден наявний інваріант 1-6 не редагується.

---

## 3. Методологія: Plan-крок отримує ADR-чекпоінт (`clarify.md` "Відкрите питання")

**Без нового 10-го шаблону** (підтверджено оператором). Замість цього:

### 3.1 Дії
У `docs/for-agents/sdd-development-methodology.md`, в описі Plan-кроку
Шаблонів 1/3/4 (Feature/Refactor/Integration) додати один абзац:
> Перед переходом у Tasks: звір рішення проти чекліста ADR-значущості
> (`constitution.md` §3.1). Якщо відповідає хоч одному пункту — створи
> `docs/adr/NNNN-slug.md` (наступний вільний номер, `ls docs/adr/`) ПЕРЕД
> `tasks.md`; `plan.md` посилається на нього замість дублювання
> обґрунтування.

`.claude/commands/sdd/{feature,refactor,integration}.md` отримують один
рядок-нагадування з посиланням на цей абзац (без дублювання тексту).

### 3.2 Acceptance
- 3 файли `.claude/commands/sdd/*.md` містять посилання на ADR-чекпоінт.
- Методологія не отримує нового `### ШАБЛОН 10` розділу.

---

## 4. Doc-drift арбітр: розширення `sdd_llm_judge.py` (`clarify.md` п.4)

### 4.1 Дії
1. `evaluate_diff()` отримує додатковий крок: якщо diff зачіпає файли поза
   `.githooks`-екслюдами І зачіпає код, на який посилається існуючий
   `spec.md`/ADR (пошук рядка `Reference: ADR-NNNN` чи шляху файлу в
   `spec.md`) — LLM-промпт отримує ці файли як контекст і перевіряє чи
   diff суперечить задокументованому рішенню.
2. При суперечності — НЕ FAIL (лишається fail-open/shadow, `P8` рішення не
   переглядається цією фічею), а `WARN` з пропозицією тексту оновлення
   (Reactive Drafting) — виводиться оператору, нічого не застосовується
   автоматично (Інваріант 3, HITL Precedence).
3. Нові тести в `tests/unit/test_sdd_judge.py` (мінімум 3: diff без
   зачеплення ADR → без змін; diff зачіпає ADR без суперечності → без
   WARN; diff суперечить ADR → WARN з чернеткою тексту).

### 4.2 Acceptance
- `pytest tests/unit/test_sdd_judge.py` 100% green, включно з новими
  тестами.
- Існуючі 11 тестів з P8 не зламані (regression-check).

---

## 5. Kindle-видання: Incremental Delta Digest (`clarify.md` п.5)

### 5.1 Дії
1. `~/projects/resume/kindle_digest.py`: `build_briefing()` отримує новий
   параметр-джерело — git-діапазон по `docs/adr/*.md` (не тільки
   `specs/*/`), збирає New/Changed/Superseded ADR за вікно.
2. Новий перший розділ digest — `"Edition N: What Changed Since Last
   Release"` (New & Changed ADRs зі стислим Decision Outcome, Superseded
   ADRs, Modified Spec Capabilities) — перед наявним тілом дайджесту, не
   замість нього.
3. НЕ чіпати `send_digest.py`/Gmail-частину — вона вже перевірена, без змін.

### 5.2 Acceptance
- Ручний прогін `kindle_digest.py --window daily --dry-run` показує новий
  розділ першим, з реальними даними з `docs/adr/`.
- Наявний cron (`0 6 * * *`) не зламаний — прогін без `--dry-run` завершує
  успішно з existing exit code.

---

## 6. Порядок виконання (Tasks — наступний крок)

Feature.json phase → `tasks`. Порядок реалізації (залежності): 1 (ADR
артефакти) → 2 (конституція, посилається на §3.1 з п.1 template) → 3
(методологія посилається на п.1+2) → 4 (арбітр, незалежний, може йти
паралельно з 1-3) → 5 (digest, залежить від існування `docs/adr/` з п.1).

## 7. Ризики / межі

- Doc-drift арбітр (п.4) — це евристика на базі LLM-проксі
  (`192.168.3.184:18880`, вже відома нестабільність з P8-нотаток) — WARN
  може хибно спрацьовувати/мовчати. Не блокуюча (shadow), прийнятний
  ризик.
- `docs/adr/0001-baseline-architecture.md` (ретроактивний) — суб'єктивний,
  пише один агент/оператор без team review (проєкт соло) — прийнятно для
  цього масштабу, не блокер.
