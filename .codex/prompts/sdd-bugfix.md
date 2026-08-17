---
description: Execute SDD Bugfix Workflow (Template 2) for vydra-swiss-survey
---

Ціль: $ARGUMENTS

1. Прочитай `.agents/skills/sdd-bugfix/SKILL.md` і виконай його буквально.
2. Інваріанти: `.specify/constitution.md`. MUST-правила: `AGENTS.md`.
3. RED-тест ДО фіксу — обов'язково, не пропускай.
4. Фінальний звіт: root cause (файл:рядок), RED→GREEN тест, impact-аналіз, `bash bin/sdd_verify.sh`.
