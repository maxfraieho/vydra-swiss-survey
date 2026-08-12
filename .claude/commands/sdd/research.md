---
description: SDD Шаблон 6 — глибоке дослідження. Створює дослідницький промпт-артефакт у docs/for-agents/prompts/gemini-research-<slug>.md.
argument-hint: <тема або опис дослідження>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 6 ("🔬 Глибоке Дослідження та Архітектурний Аналіз") з `docs/for-agents/sdd-development-methodology.md` для теми: $ARGUMENTS

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 6", і виконай його крок за кроком.
2. Проаналізуй поточний стан коду, схеми БД у `persona_graph_memory.py` та інваріанти з `.specify/constitution.md`.
3. Створи самодостатній дослідницький промпт-артефакт у `docs/for-agents/prompts/gemini-research-<slug>.md`.
4. У фінальному звіті покажи шлях до створеного промпт-файлу та надай інструкцію для його запуску у Gemini / Deep Reasoning AI.
