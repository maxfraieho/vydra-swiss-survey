---
description: SDD Шаблон 9 — комплексна верифікація цілісності специфікацій, системних інваріантів, WAL режиму, pytest та deploy-сюїти.
argument-hint: 
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 9 ("🛡️ Комплексна Верифікація Специфікацій та Системи") з `docs/for-agents/sdd-development-methodology.md`.

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 9", і виконай його крок за кроком.
2. Прожени специфікаційний верифікатор: `bash bin/sdd_verify.sh`.
3. Перевір режим SQLite WAL та роботу автопромоції $N \ge 3$.
4. Прожени повну тестову сюїту `python3 -m pytest tests/` та верифікацію деплою `bash deploy/verify_installation.sh`.
