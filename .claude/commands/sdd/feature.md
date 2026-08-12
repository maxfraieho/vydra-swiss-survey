---
description: SDD Шаблон 1 — нова фіча. Створює spec.md/tasks.md, gitnexus impact-check, RED→GREEN тести, реалізацію.
argument-hint: <назва фічі> — <опис задачі>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 1 ("🎨 Нова Фіча") з `docs/for-agents/sdd-development-methodology.md` для задачі: $ARGUMENTS

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 1", і виконай його буквально крок за кроком — не вигадуй власну послідовність.
2. Перед специфікацією прочитай `.specify/constitution.md` — інваріанти (гарячий шлях < 5мс, гейт `N ≥ 3`, WAL SQLite) мають бути враховані в `spec.md`.
3. Визнач наступний вільний номер `specs/<NNN>-<slug>/`: виконай `ls specs/` і подивись, не вгадуй номер з пам'яті.
4. Дотримуйся МУСТ-правил з `AGENTS.md` (imperativ impact-аналіз перед правкою символу, `detect_changes()` перед комітом).
5. У фінальному звіті вкажи: створені файли, результат `check_gitnexus_impact.py`, результат `pytest`, і чи пройшов `bash bin/sdd_verify.sh`.
