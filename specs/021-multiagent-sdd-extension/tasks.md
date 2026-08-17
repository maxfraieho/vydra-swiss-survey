# Tasks — 021-multiagent-sdd-extension

> Декомпозиція фаз P0-P9 з `plan.md` на атомарні задачі. Кожна задача — окремий
> git-коміт з докaзом виконання (файл:рядок / вивід команди), не голослівне
> "зроблено".

## P0 — Clarify ✅

- [x] T-101: Провести Шаблон 7, закрити 7 питань → `clarify.md`

## P1 — Spec ✅

- [x] T-102: Написати `spec.md` (6 user stories, інваріанти, out-of-scope)

## P2 — Shared skills (`.agents/skills/`) ✅

- [x] T-103: `.agents/skills/sdd-feature/SKILL.md`
- [x] T-104: `.agents/skills/sdd-bugfix/SKILL.md`
- [x] T-105: `.agents/skills/sdd-refactor/SKILL.md`
- [x] T-106: `.agents/skills/sdd-integration/SKILL.md`
- [x] T-107: `.agents/skills/sdd-teaching/SKILL.md`
- [x] T-108: Верифікація frontmatter — усі 5 файлів мають валідний `name`+`description` YAML, підтверджено `find`-лістингом на dev-184

## P3 — Codex prompts ⚠️ частково (файли створені, TUI-верифікація не автоматизується)

- [x] T-109..T-113: `.codex/prompts/sdd-{feature,bugfix,refactor,integration,teaching}.md` — створено, тонкі лаунчери з `$ARGUMENTS`, посилаються на `.agents/skills/sdd-*/SKILL.md`
- [x] T-114: `trust_level` перевірено — `/home/vokov/projects` = `trusted` в `~/.codex/config.toml`; точний запис для `/home/vokov/projects/vydra-swiss-survey` відсутній, успадкування за префіксом НЕ підтверджено
- [ ] T-115: Smoke-тест НЕ виконано — `codex --help`/`codex exec --help` підтвердили, що `.codex/prompts/`-меню є TUI-only фічею без CLI-інтроспекції; `codex exec` non-interactive не читає `.codex/prompts/`. Потребує ручної інтерактивної перевірки оператором (відкрити `codex` в репо, перевірити `/sdd-feature` в списку команд)

## P4 — Docs ✅

- [x] T-116: `README-sdd-commands.md` — секція "Щодо agy" переписана підтвердженими фактами
- [x] T-117: `README-sdd-commands.md` — додано секцію "Codex CLI"
- [x] T-118: `README-sdd-commands.md` — список команд Claude Code оновлено 5→9
- [x] T-119: `sdd-development-methodology.md` §5 — каталог скілів оновлено (14 файлів: 8 speckit-* + 6 sdd-*, було невірно "7")
- [x] T-120: `sdd-development-methodology.md` §6.1 — 9 команд замість 5
- [x] T-121: `sdd-development-methodology.md` §6.2 — Agy підтверджені факти (deprecated `.agent/commands/`, Progressive Disclosure, немає `$ARGUMENTS`)
- [x] T-122: `sdd-development-methodology.md` новий §6.4 — Codex CLI (гібрид prompts+skills, статус верифікації чесно позначено як непідтверджений)

## P5 — Native Spec Kit (HIGH RISK) ✅

- [x] T-123: Backup `.specify/constitution.md` → `.specify/constitution.md.pre-install-backup`
- [x] T-124: `curl 127.0.0.1:5005/ops` baseline (до install) — 200
- [x] T-125: `specify integration install claude` — OK. **Side effect:** перезаписав 4 наявні `.claude/skills/speckit-{clarify,constitution,plan,specify}` офіційним upstream (research "manifest preserves user mods" не підтвердилось на першому install — hash-трекінгу ще не було). Користувач підтвердив залишити upstream.
- [x] T-126: `git diff --stat .specify/constitution.md` — порожньо, не зачеплено
- [x] T-127: `specify integration info codex` — `--integration-options="--skills"` НЕ підтверджено (codex вже "skills-based" за замовчуванням, довідка install не згадує `--skills`)
- [x] T-128: `specify integration install codex` (без невірного прапорця) — OK. Той самий overwrite-ефект, але для `.agents/skills/speckit-*` (не `.claude/skills/`) — обидва дерева тепер синхронізовані офіційним upstream
- [x] T-129: Повторна перевірка — конституція не зачеплена
- [x] T-130: `curl 127.0.0.1:5005/ops` — 200, прод не постраждав
- [x] T-131: Конституція → 1.1.0, §3 переписано: виправлено фантомні `/speckit.*` як literal slash-команди → таблиця мапінгу з коректним поясненням (Agent Skills, semantic/model invocation, не текстова підстановка)
- [x] T-132: `specify integration status` → `claude, codex` встановлені, `Modified managed files: 0`

**Додатково знайдено (не в оригінальному tasks.md):** `.specify/.gitignore` (згенерований install) ігнорує `feature.json` як "не для шарингу між машинами" — конфліктує з нашим Handoff Protocol (P6), де `feature.json` МАЄ бути трекований для міжагентного стану. Не блокер (файл вже трекований, ігнор не діє на трекований файл), але задокументовано як свідомий відхід від нативної конвенції Spec Kit. `.specify/integrations/.cache/` (28K, regenerable API-каталог) — додано в `.gitignore`, не закомічено.

## P6 — Handoff enforcement ✅

- [x] T-133: `.specify/feature.json` створено (bootstrap на цю ж фічу — dogfooding), оновлювався на кожному фазовому переході P0-P5
- [x] T-134: `AGENTS.md` → «Always Do» — 3 нові MUST-правила (feature.json читання перед стартом + STOP при branch-mismatch, оновлення на кожному переході окремим комітом, `sdd_verify.sh --gate` перед правкою коду)
- [x] T-135: Retro-fill для P0-P5 — виконано через послідовні коміти `feature.json` на кожній фазі (P1/tasks, P5)

## P7 — `sdd_verify.sh` рефакторинг ✅

- [x] T-136: Динамічний обхід `specs/*/` — замінено 32-шляховий хардкод. Знайдено і виправлено реальний баг під час тестування: перша версія вимагала `spec.md` безумовно, що ламалось на `001-sdd-migration` (лише `plan.md`+`tasks.md`, старіший за конвенцію spec.md) — послаблено до WARN, не FAIL
- [x] T-137: Режим `--gate` — читає `feature.json`, phase-залежні вимоги, перевірка branch-match
- [x] T-138: Режим `--arbiter` — викликає `scripts/sdd_llm_judge.py --staged` якщо існує (P8 ще не зроблено — no-op з попередженням)
- [x] T-139: `bash bin/sdd_verify.sh` на `master`-клоні (порт 5006 checkout) → **PASS**, `001-sdd-migration` дав очікуваний WARN, не FAIL
- [x] T-140: `bash bin/sdd_verify.sh` на `astryx-ui-refactor` → **PASS**
- [x] T-141: Non-tautological тест — фізично прибрано `specs/021.../plan.md`, `--gate` → `exit 1` з точною назвою відсутнього файлу, відновлено, `--gate` → `exit 0`. Реальний RED→GREEN цикл, не tautology

## P8 — LLM Arbiter

- [ ] T-142: `~/.vydra-survey-profiles/sdd_judge.env` — `SDD_JUDGE_KEY`, `SDD_JUDGE_MODEL`
- [ ] T-143: `GET /v1/models` на проксі з реальним ключем — визначити `SDD_JUDGE_MODEL` дефолт
- [ ] T-144: `scripts/sdd_llm_judge.py` — база з дослідження + правки §5.4 `plan.md` (401-handling, конфігурований model, fallback JSON-екстракція, логування, phase-aware промпт)
- [ ] T-145: `tests/unit/test_sdd_judge.py` — behavioral тест з мок HTTP (PASS/FAIL/timeout/no-spec сценарії)
- [ ] T-146: `.githooks/pre-commit` — виклик judge, fail-open логіка
- [ ] T-147: `git config core.hooksPath .githooks`
- [ ] T-148: Shadow-режим (`--dry-run`, лише логує, не блокує) — 1 тиждень спостереження
- [ ] T-149: Після shadow-періоду — рішення оператора: увімкнути блокування чи ще шліфувати

## P9 — AGY-верифікація (паралельно після P4)

- [ ] T-150: Sync гілки `astryx-ui-refactor` на AGY (телефон)
- [ ] T-151: Підтвердити `/sdd-feature`…`/sdd-teaching` в TUI на AGY
- [ ] T-152: Повторити T-151 на AGY2 (ноутбук), якщо доступний
- [ ] T-153: Повторити T-151 на AGY3 (планшет), якщо доступний

## Acceptance (фінальна перевірка проти `plan.md` §8)

- [ ] T-154: Прогнати всі 10 acceptance-критеріїв `plan.md` §8, задокументувати результат кожного

