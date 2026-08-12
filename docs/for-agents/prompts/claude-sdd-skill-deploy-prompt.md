# Системний Промпт для Claude: Розгортання SDD Скіла у Будь-якому Репозиторії

> **Документ:** `docs/prompts/claude-sdd-skill-deploy-prompt.md`  
> **Призначення:** Скопіюйте та відправте цей текст Claude Code / Claude Desktop для автоматичного розгортання та активування скіла Spec-Driven Development (SDD) у будь-якому проєкті.

---

```text
Ти — автономний кодинг-агент Claude. Твоє завдання — розгорнути та активувати скіл Spec-Driven Development (SDD Workflow Skill) у цьому репозиторії.

📍 КРОК 1 — СТВОРЕННЯ ДИРЕКТОРІЇ ТА ФАЙЛУ СКТЛА:
Створи файл `.agents/skills/sdd-workflow/SKILL.md` (або `.claude/skills/sdd-workflow/SKILL.md`) з наступним вмістом:

---
name: sdd-workflow
description: Spec-Driven Development (SDD) methodology guide for specify-cli, project constitution, and behavioral non-tautological testing.
---

# Spec-Driven Development (SDD) Workflow Skill

## Core SDD Principles
1. **Specification as Single Source of Truth:** Specifications in `specs/<feature>/spec.md` define WHAT the system should do. Code MUST implement the spec; tests MUST verify behavioral consequences of the spec.
2. **Code First, Spec Second (No Memory Hallucinations):** Always inspect actual code signatures, line numbers, and database schemas before writing specs or tests.
3. **Honest Behavioral Tests (No Tautologies):** Tests must have a real chance to fail. Avoid `assert len(x) > 0` or `assert x == x`. Verify actual side effects, priority cascades, and failure handlings.
4. **Hot-Path Preservation:** Main execution loops MUST stay lightweight, synchronous, and zero-overhead. Heavy tasks (specs, network calls, audits) run asynchronously outside live execution.
5. **Empirical Verification:** Use real tool measurements (impact analysis, latency benchmarks) rather than arbitrary uncalibrated formulas.

## SDD Artifact Lifecycle
1. `.specify/constitution.md` -> High-level project invariants.
2. `specs/<domain>/spec.md` -> Feature specification (User stories, scenarios, Given-When-Then, invariants).
3. `specs/<domain>/plan.md` -> Technical implementation strategy & risk analysis.
4. `specs/<domain>/tasks.md` -> Modular task breakdown (T-101, T-102...).
5. `tests/unit/`, `tests/integration/`, `tests/regression/` -> Executable test suite verifying the specification.

📍 КРОК 2 — СТВОРЕННЯ СТРУКТУРИ ДИРЕКТОРІЙ:
Створи наступні папки, якщо вони ще не існують:
- `.specify/`
- `specs/`
- `tests/unit/`
- `tests/integration/`
- `tests/regression/`

📍 КРОК 3 — ПЕРЕВІРКА ТА ЗВІТ:
Підтверди створення файлу скіла, перевір його валідність та виведи короткий звіт про готовність репозиторію до SDD-розробки.
```
