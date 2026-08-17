# Tasks — 021-multiagent-sdd-extension

> Декомпозиція фаз P0-P9 з `plan.md` на атомарні задачі. Кожна задача — окремий
> git-коміт з докaзом виконання (файл:рядок / вивід команди), не голослівне
> "зроблено".

## P0 — Clarify ✅

- [x] T-101: Провести Шаблон 7, закрити 7 питань → `clarify.md`

## P1 — Spec ✅

- [x] T-102: Написати `spec.md` (6 user stories, інваріанти, out-of-scope)

## P2 — Shared skills (`.agents/skills/`)

- [ ] T-103: `.agents/skills/sdd-feature/SKILL.md`
- [ ] T-104: `.agents/skills/sdd-bugfix/SKILL.md`
- [ ] T-105: `.agents/skills/sdd-refactor/SKILL.md`
- [ ] T-106: `.agents/skills/sdd-integration/SKILL.md`
- [ ] T-107: `.agents/skills/sdd-teaching/SKILL.md`
- [ ] T-108: Верифікація frontmatter (`name`+`description`) усіх 5 файлів валідний YAML

## P3 — Codex prompts

- [ ] T-109: `.codex/prompts/sdd-feature.md` (+4 аналогічні: bugfix/refactor/integration/teaching) — T-109..T-113
- [ ] T-114: Перевірити `trust_level` в `~/.codex/config.toml` для `/home/vokov/projects/vydra-swiss-survey`
- [ ] T-115: Smoke-тест — `codex` у корені репо, підтвердити `/sdd-feature` в TUI-списку команд (скріншот/вивід команди-листингу)

## P4 — Docs

- [ ] T-116: `README-sdd-commands.md` — переписати секцію "Щодо agy" підтвердженими фактами
- [ ] T-117: `README-sdd-commands.md` — додати секцію "Codex CLI"
- [ ] T-118: `README-sdd-commands.md` — оновити список команд Claude Code (5→9)
- [ ] T-119: `sdd-development-methodology.md` §5 — оновити каталог скілів (реальний перелік)
- [ ] T-120: `sdd-development-methodology.md` §6.1 — 9 команд замість 5
- [ ] T-121: `sdd-development-methodology.md` §6.2 — Agy підтверджені факти
- [ ] T-122: `sdd-development-methodology.md` новий §6.4 — Codex CLI

## P5 — Native Spec Kit (HIGH RISK)

- [ ] T-123: Backup `.specify/constitution.md` → `.specify/constitution.md.pre-install-backup`
- [ ] T-124: `curl 127.0.0.1:5005/ops` baseline (до install)
- [ ] T-125: `specify integration install claude`
- [ ] T-126: `git diff --stat .specify/constitution.md` — якщо зачеплено, `git checkout --` + відновити з backup
- [ ] T-127: `specify integration info codex` — підтвердити реальні опції CLI
- [ ] T-128: `specify integration install codex --integration-options="--skills"` (або без прапорця, за T-127)
- [ ] T-129: Повторити перевірку T-126 для codex-install
- [ ] T-130: `curl 127.0.0.1:5005/ops` — підтвердити 200 (прод не постраждав)
- [ ] T-131: Конституція → версія 1.1.0, §3 → таблиця мапінгу (`plan.md` §1.1.5)
- [ ] T-132: `specify integration status` → підтвердити `claude, codex` встановлені

## P6 — Handoff enforcement

- [ ] T-133: Створити `.specify/feature.json` (bootstrap на цю ж фічу — dogfooding)
- [ ] T-134: `AGENTS.md` → «Always Do» — додати 4 обов'язки з `plan.md` §4.3
- [ ] T-135: Оновлювати `feature.json` на кожному фазовому переході цієї ж фічі (retro-fill для P0-P5)

## P7 — `sdd_verify.sh` рефакторинг

- [ ] T-136: Динамічний обхід `specs/*/` замість хардкод-allowlist
- [ ] T-137: Режим `--gate` (читає `feature.json`, валідує активну фічу)
- [ ] T-138: Режим `--arbiter` (виклик `sdd_llm_judge.py --staged`)
- [ ] T-139: Regression-тест: `bash bin/sdd_verify.sh` PASS на `master`
- [ ] T-140: Regression-тест: `bash bin/sdd_verify.sh` PASS на `astryx-ui-refactor`
- [ ] T-141: Non-tautological тест: штучно видалити `plan.md` активної фічі → `--gate` FAIL

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
