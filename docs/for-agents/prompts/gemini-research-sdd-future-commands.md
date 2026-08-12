# 🔬 GEMINI RESEARCH PROMPT: Перспективний розвиток /sdd:* slash-команд для vydra-swiss-survey

> **Документ:** `docs/for-agents/prompts/gemini-research-sdd-future-commands.md`  
> **Методологія:** Spec-Driven Development (SDD) via GitHub Spec Kit (`specify-cli` v0.16.2) & GitNexus  
> **Автор/Дата:** Autonomous Agent Agy / 12 серпня 2026 року  

---

## 🎯 1. РОЛЬ ТА КОНТЕКСТ ЗАВДАННЯ

Ти — головний архітектор та методист розробки AI-агентів системи `vydra-swiss-survey`. Твоя мета — провести глибокий аналіз наявної системи SDD-команд та запропонувати оптимальний перелік додаткових `/sdd:*` slash-команд для максимальної ефективності та автономності розробки.

### Фактичний стан системи SDD-команд (станом на зараз):
Наразі у `.claude/commands/sdd/` та `docs/for-agents/sdd-development-methodology.md` розгорнуто **6 активних slash-команд**:

| Команда | SDD Шаблон | Основне призначення |
| :--- | :--- | :--- |
| **`/sdd:feature`** | Шаблон 1 | Розробка нової фічі (spec, plan, tasks, RED->GREEN TDD). |
| **`/sdd:bugfix`** | Шаблон 2 | Ізоляція та виправлення бага з регресійним тестом. |
| **`/sdd:refactor`** | Шаблон 3 | Безпечний рефакторинг із замірами латентності (p95). |
| **`/sdd:integration`** | Шаблон 4 | Інтеграція нових сервісів/протоколів (Synapse, CDP). |
| **`/sdd:teaching`** | Шаблон 5 | Навчання агента (HITL), запис shadow-правил та $N \ge 3$ промоція. |
| **`/sdd:research`** | Шаблон 6 | Глибоке дослідження та генерація дослідницьких промптів. |

---

## 📋 2. ВХІДНІ ДАНІ ТА СТИСЛИЙ ОПИС КОДОВОЇ БАЗИ

1. **Проєктна Конституція:** [`.specify/constitution.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/.specify/constitution.md)
   * 6 недоторканних інваріантів: Hot Path < 5ms ([`survey_agent.py:L260`](file:///data/data/com.termux/files/home/vydra-swiss-survey/survey_agent.py#L260)), SQLite WAL mode ([`persona_graph_memory.py:L220`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L220)), HITL precedence 100%, N≥3 rule promotion ([`persona_graph_memory.py:L595`](file:///data/data/com.termux/files/home/vydra-swiss-survey/persona_graph_memory.py#L595)), PII protection, prohibition of direct pushes to dev-184.
2. **Специфікаційний верифікатор:** [`bin/sdd_verify.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/bin/sdd_verify.sh) (перевіряє 18 spec-файлів та команд).
3. **Універсальний деплой-сюїт:** [`deploy/install.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/install.sh), [`deploy/verify_installation.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/verify_installation.sh).
4. **Скіли розширення:** `.agents/skills/` (12 скілів, включаючи `speckit-*`, `gitnexus-*`, `sdd-workflow`).

---

## 🔬 3. КЛЮЧОВІ ПИТАННЯ ДЛЯ АНАЛІЗУ (RESEARCH QUESTIONS)

Проаналізуй життєвий цикл розробки та дай відповіді на 4 ключові запитання:

### Питання 1: Які етапи SDD-циклу наразі НЕ покриті окремою /sdd:* командою?
Оціни наступні кандидатні команди та їх доцільність:
1. **`/sdd:clarify`** — Брейнштормінг та зняття неоднозначностей перед специфікацією (використовує `speckit-clarify` скіл).
2. **`/sdd:audit` / `/sdd:drift`** — Глибокий аудит відхилення коду від специфікацій (`spec-drift`) за допомогою `speckit-canon`.
3. **`/sdd:verify` / `/sdd:status`** — Генерація візуального дашборду стану виконання всіх специфікацій (`specs/001..009`).
4. **`/sdd:deploy`** — Запуск універсальної перевірки та деплою на VPS за допомогою `deploy/`.

### Питання 2: Яка команда принесе найбільшу користь для мінімізації помилок AI-агентів?
Обґрунтуй з точки зору зменшення контексту (token efficiency) та запобігання фальшивим висновкам агента.

### Питання 3: Як нові команди повинні інтегруватися з існуючими скілами (`.agents/skills/`)?
Забезпеч 100% сумісність із Claude Code та Agy, з посиланням на `docs/for-agents/sdd-development-methodology.md` як single source of truth.

---

## 🎯 4. ОЧІКУВАНА ФОРМА ВІДПОВІДІ (EXPECTED OUTPUT)

Надай відповідь у формі структурованого звіту з наступними розділами:
1. **Топ-3 рекомендованих нових `/sdd:*` команд** із їх чітким описом та шаблонами.
2. **Матриця покриття SDD-життєвого циклу** (існуючі vs нові команди).
3. **Рекомендації щодо реалізації** (які файли створити у `.claude/commands/sdd/` та `specs/`).
