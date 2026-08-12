---
description: SDD Шаблон 8 — глибокий аудит відхилення коду від специфікацій (spec-drift) та перевірка зони ураження.
argument-hint: <назва модуля або spec для аудиту>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 8 ("🔍 Глибокий Аудит Відхилення Коду та Spec-Drift") з `docs/for-agents/sdd-development-methodology.md` для: $ARGUMENTS

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 8", і виконай його крок за кроком.
2. Зістави специфікацію `specs/<target>/spec.md` із фактичним кодом у кодовій базі.
3. Виконай `python3 scripts/check_gitnexus_impact.py <symbol>` для перевірки зони ураження.
4. Сформуй підсумкову таблицю Spec-Drift та прожени `bin/sdd_verify.sh`.
