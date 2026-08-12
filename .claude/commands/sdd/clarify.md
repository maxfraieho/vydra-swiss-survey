---
description: SDD Шаблон 7 — зняття неоднозначностей, виявлення blind spots та формалізація assumptions до написання специфікації.
argument-hint: <опис ідеї або нової вимоги>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 7 ("💡 Зняття Неоднозначностей та Брейнштормінг") з `docs/for-agents/sdd-development-methodology.md` для: $ARGUMENTS

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 7", і виконай його крок за кроком.
2. Перевір інваріанти у `.specify/constitution.md` (Hot Path < 5ms, SQLite WAL mode).
3. Постав користувачу від 3 до 5 точних уточнюючих питань із варіантами відповідей (A, B, C).
4. Сформуй блок явних припущень `Assumptions I'm Making` та чернетку Given-When-Then для специфікації `specs/`.
