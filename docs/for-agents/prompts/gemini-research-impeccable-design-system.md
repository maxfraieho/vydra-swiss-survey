# 🔬 GEMINI RESEARCH PROMPT: Аналіз та інтеграція дизайн-системи Impeccable (pbakaus/impeccable) u Termux / Astryx UI

> **Документ:** `docs/for-agents/prompts/gemini-research-impeccable-design-system.md`  
> **Цільова репозиторія:** `https://github.com/pbakaus/impeccable`  
> **Проєкт-контекст:** `vydra-swiss-survey` (Termux Android, React Astryx UI u `web/src/`, SQLite WAL)  

---

## 🎯 1. РОЛЬ ТА КОНТЕКСТ ЗАВДАННЯ

Ти — головний UI/UX інженер та системний архітектор. Проведи аналіз репозиторію `pbakaus/impeccable` та оціни його сумісність із проєктом `vydra-swiss-survey`.

---

## 🔬 2. КЛЮЧОВІ ПИТАННЯ ДЛЯ ДОСЛІДЖЕННЯ

1. **Сумісність із Termux / Node.js / Python у Termux:**
   - Чи потребує Impeccable додаткових важких CLI бінарників чи C++ залежностей?
   - Чи підтримуються стандарти `.impeccable/` у мобільному/Linux середовищі Termux?
2. **Інтеграція з React Astryx UI (`web/src/`):**
   - Як Impeccable взаємодіє з наявними компонентами React (`SurveyOps.tsx`, `RulesTable.tsx`, `PatternsPanel.tsx`)?
   - Чим відрізняються базові документи `PRODUCT.md` та `DESIGN.md` від проєктних файлів у `docs/`?
3. **Захист кодової бази та Git (PII & Build artifacts):**
   - Які правила `.gitignore` необхідні для маскування тимчасових скріншотів (`.impeccable/live/`, `*.png`) та кешів?
4. **Скіли та сумісність з агентами (Agy / Claude):**
   - Як скопіювати/адаптувати скіли Impeccable у `.agents/skills/` та `.claude/skills/` для забезпечення прозорої роботи Agy та Claude Code?

---

## 🎯 3. ОЧІКУВАНИЙ РЕЗУЛЬТАТ

Сформуй структурований висновок із готовістю до реалізації Фази 2.
