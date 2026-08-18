# Tasks — 022-adr-integration

> Декомпозиція `plan.md` на атомарні задачі. Кожна задача — окремий
> git-коміт з доказом виконання (файл:рядок / вивід команди), не голослівне
> "зроблено". Нумерація `T-3xx` — блок 022 (021 зайняв `T-1xx`, 020 зайняв
> `T-2xx`, уникаємо колізії).

## P0 — Clarify ✅ / Plan ✅

- [x] T-301: Шаблон 7 закрито, 7 питань → `clarify.md` (deep research AGY
  .234 + Gemini Pro/NotebookLM, конвергентні відповіді)
- [x] T-302: `plan.md` написано, узгоджено з оператором (без нового 10-го
  шаблону)

## P1 — ADR-артефакти (`plan.md` §1)

- [x] T-303: `docs/adr/template.md` — шаблон MADR v3.x (усі обов'язкові
  секції + YAML frontmatter `status/date/deciders/spec/supersedes`)
- [x] T-304: `docs/adr/0001-baseline-architecture.md` — ретроактивний,
  `status: Accepted (Retroactive)`, фіксує Flask/Termux, SQLite WAL, прямий
  CDP, Astryx design system
- [x] T-305: `docs/adr/0002-madr-format-adoption.md` — перший живий ADR,
  `spec: specs/022-adr-integration`, документує саме це рішення (MADR +
  наскрізна нумерація, без log4brains)
- [x] T-306: Верифікація — обидва ADR мають усі MADR-секції заповнені (не
  заглушки), перевірено вручну діфом проти `template.md`

## P2 — Конституція §3.1 (`plan.md` §2)

- [x] T-307: Додати підрозділ "Критерій ADR-значущості" (5-пунктовий
  чекліст з `clarify.md` п.6) в `.specify/constitution.md`
- [x] T-308: `git diff --stat .specify/constitution.md` — підтвердити лише
  append, жоден з інваріантів 1-6 не редагувався
- [x] T-309: Версія конституції → 1.2.0 в заголовку

## P3 — Методологія: ADR-чекпоінт без нового шаблону (`plan.md` §3)

- [x] T-310: `docs/for-agents/sdd-development-methodology.md` — абзац
  ADR-чекпоінту в описі Plan-кроку Шаблонів 1 (Feature), 3 (Refactor), 4
  (Integration)
- [x] T-311: `.claude/commands/sdd/feature.md` — рядок-нагадування з
  посиланням на новий абзац
- [x] T-312: `.claude/commands/sdd/refactor.md` — те саме
- [x] T-313: `.claude/commands/sdd/integration.md` — те саме
- [x] T-314: Верифікація — `grep -c 'ШАБЛОН 10'
  docs/for-agents/sdd-development-methodology.md` = 0 (підтвердження: новий
  шаблон НЕ додано)

## P4 — Doc-drift арбітр (`plan.md` §4, незалежний від P1-P3, може паралельно)

- [x] T-315: `scripts/sdd_llm_judge.py` — `evaluate_diff()` отримує крок
  пошуку `Reference: ADR-NNNN` у зачеплених `spec.md`/зачеплених файлах
- [x] T-316: Той самий файл — WARN-гілка (не FAIL) з чернеткою пропозиції
  оновлення при виявленій суперечності
- [x] T-317: `tests/unit/test_sdd_judge.py` — тест 1: diff без зачеплення
  ADR → без змін поведінки
- [x] T-318: `tests/unit/test_sdd_judge.py` — тест 2: diff зачіпає ADR без
  суперечності → без WARN
- [x] T-319: `tests/unit/test_sdd_judge.py` — тест 3: diff суперечить ADR →
  WARN з текстом чернетки
- [x] T-320: `pytest tests/unit/test_sdd_judge.py` — 14/14 green (11
  наявних з P8 + 3 нових), regression підтверджено

## P5 — Kindle Incremental Delta Digest (`plan.md` §5, залежить від P1)

- [x] T-321: `~/projects/resume/kindle_digest.py` — `build_briefing()`
  отримує джерело `docs/adr/*.md` (git-діапазон по вікну), не тільки
  `specs/*/`
- [x] T-322: Новий розділ `"Edition N: What Changed Since Last Release"` —
  рендериться першим у тілі дайджесту
- [x] T-323: Ручний прогін `kindle_digest.py --window daily --dry-run` —
  новий розділ присутній, дані реальні (не заглушки)
- [x] T-324: Прогін наявного cron-запису (`0 6 * * *`) без `--dry-run` —
  exit code 0, `send_digest.py` не зачеплено (без змін, per `plan.md` §5.1
  п.3)

## P6 — Verify

- [ ] T-325: `bash bin/sdd_verify.sh --gate` — фаза `implement` для
  `specs/022-adr-integration` проходить (усі required-артефакти P1-P5
  наявні)
- [ ] T-326: `.specify/feature.json` — `phase: "verify"`,
  `phases_done` включає всі P0-P6

## P7 — Портування в sdd-universal-template (окремий крок, ПІСЛЯ живого
тестування P1-P6 у цьому репо — за прямою вказівкою оператора)

- [ ] T-327: `template/docs/adr/template.md.jinja` — генералізований MADR
  шаблон (без vydra-специфічних прикладів)
- [ ] T-328: `template/.specify/constitution.md.jinja` — доповнити §3.1
  ADR-чекліст умовним Jinja-блоком (`{% if enable_adr %}`, новий
  `copier.yml` question)
- [ ] T-329: `template/docs/for-agents/sdd-development-methodology.md.jinja`
  — той самий ADR-чекпоінт абзац
- [ ] T-330: `template/scripts/sdd_llm_judge.py.jinja` — doc-drift
  розширення (той самий `{% raw %}` захист довкола Python f-string
  прикладів, за прецедентом P8-фікса)
- [ ] T-331: CI smoke-test template repo (`template-ci.yml`) — Copier
  generate з `enable_adr: true` і `enable_adr: false`, обидва без
  `TemplateSyntaxError`
