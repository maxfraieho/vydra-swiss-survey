---
description: Execute SDD Integration Workflow (Template 4) for vydra-swiss-survey
---

Ціль: $ARGUMENTS

1. Прочитай `.agents/skills/sdd-integration/SKILL.md` і виконай його буквально.
2. Інваріанти: `.specify/constitution.md`. MUST-правила: `AGENTS.md`.
3. Повна ізоляція від гарячого шляху, жорсткий таймаут за реальним p95.
4. Фінальний звіт: адаптер, round-trip перевірка, regression-тест, `bash bin/sdd_verify.sh`.
