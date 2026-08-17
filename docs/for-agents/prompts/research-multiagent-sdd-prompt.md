# Deep Research Prompt — Multi-Agent SDD Extension

> Згенеровано Claude Code (оркестратор), 2026-08-17. Мета: знайти способи
> поширити вже наявний SDD-workflow проєкту на всіх агентів (Claude Code,
> AGY, Codex CLI, LLM-проксі), не тільки Claude Code.

## Ціль

Знайти фреймворки/патерни/практики, які допоможуть поширити ВЖЕ ІСНУЮЧИЙ
SDD-workflow (Spec-Driven Development) проєкту vydra-swiss-survey на ВСІХ
агентів, з якими ведеться робота, а не лише Claude Code.

Репо: https://github.com/maxfraieho/vydra-swiss-survey (dev: 192.168.3.184,
prod: https://survey.exodus.pp.ua/ops)

## Поточний стан SDD в проєкті (вже реалізовано)

- `.specify/constitution.md` — конституція проєкту (незмінні правила)
- `AGENTS.md` — MUST-правила: "Spec First, Code Second", читати
  `.agents/skills/sdd-workflow/SKILL.md` перед будь-якою фічею/API/UI
- `docs/for-agents/sdd-development-methodology.md` — єдине джерело правди,
  містить 5 шаблонів (feature/bugfix/refactor/integration/teaching)
- `.claude/commands/sdd/` — 5 slash-команд Claude Code (`/sdd:feature`,
  `/sdd:bugfix`, `/sdd:refactor`, `/sdd:integration`, `/sdd:teaching`),
  кожна лише посилається на методологію, не дублює текст
- `bin/sdd_verify.sh` — скрипт перевірки, вимагає докази (файл:рядок,
  вивід тестів) замість голослівного "зроблено"
- `specs/<NNN-feature>/{spec.md,plan.md,tasks.md}` — 20+ фіч вже так
  задокументовано (напр. 009-sdd-research-command, 010-sdd-expanded-commands)
- GitNexus індексує репо, MUST impact-analysis перед кожною зміною символу

## Агенти в роботі (різний рівень підтримки SDD)

1. **Claude Code** — повна підтримка через `.claude/commands/` + `AGENTS.md`
2. **AGY (antigravity-cli**, кілька інстансів: телефон/AGY2 ноутбук/AGY3
   планшет) — читає `.agents/skills/sdd-workflow/SKILL.md`, але БЕЗ
   підтвердженого власного slash/CLI command-механізму
3. **Codex CLI (OpenAI)** — використовується для делегування, поки БЕЗ
   підтвердженої SDD-інтеграції в цьому проєкті
4. **Власний LLM-проксі** (OpenAI-сумісний, `192.168.3.184:18880`,
   `free-claude-code-proxy`) — model provider, не агент-виконавець сам собою

## Що треба знайти

1. Чи Codex CLI (OpenAI) має нативну підтримку `AGENTS.md`-конвенції та
   власних slash/custom-command механізмів (`.codex/commands/` чи подібне) —
   точний формат/синтаксис
2. Чи antigravity-cli (agy) документує власний command/prompt-template
   механізм — підтвердити чи спростувати наявність `$ARGUMENTS`-підстановки
3. Приклади "multi-agent SDD" з відкритих джерел: проєкти, що тримають
   ОДНЕ джерело правди при роботі з кількома CLI одночасно (Claude Code +
   Codex + Gemini CLI + Cursor) — шукати репо з `.claude/commands/`,
   `.codex/`, `AGENTS.md`, `GEMINI.md` в одному дереві
4. Чи є генератор, що з ОДНОГО методологічного файлу компілює command-файли
   під різні агенти замість ручного дублювання — GitHub Spec Kit це вміє
   (35 інтеграцій) — чи можна адаптувати `spec-kit init` без перезапису
   вже наявних `specs/001..020`
5. Верифікація консистентності між агентами: якщо Claude виконав
   `/sdd:feature`, а Codex продовжує ту саму фічу — як гарантувати що
   обидва бачать один stateful `plan.md`/`tasks.md` без drift
6. Чи LLM-проксі можна використати як спільний "суддя" SDD-етапів —
   crosscheck `spec.md` з фактичним diff перед комітом, незалежно від агента

## Формат відповіді

Список знахідок з джерелами (URL), окремо "підтверджено" vs
"не знайдено/припущення". Якщо для Codex CLI або agy нема нативного
command-механізму — сказати прямо, запропонувати простий обхід (посилання
на методологію в prompt, без імітації slash-команд там де їх нема).
