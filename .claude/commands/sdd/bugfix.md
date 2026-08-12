---
description: SDD Шаблон 2 — виправлення багу/інциденту. Regression-тест у RED до фіксу, gitnexus impact, точкова правка.
argument-hint: <опис проблеми або витяг з логу помилки>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 2 ("🐛 Виправлення Багу / Проблема") з `docs/sdd-development-methodology.md` для: $ARGUMENTS

1. Прочитай `docs/sdd-development-methodology.md`, розділ "ШАБЛОН 2", і виконай його крок за кроком.
2. Спочатку локалізуй першопричину в реальному коді — процитуй точний `файл:рядок` і сигнатуру, не вигадуй з пам'яті.
3. Створи `tests/regression/test_<issue_name>.py`, що моделює баг, і підтверди RED-стан ДО будь-якої правки.
4. Перевір зону ураження через `python3 scripts/check_gitnexus_impact.py <symbol>` перед внесенням фіксу.
5. Заборонено маскувати баг порожнім `try/except: pass` чи dummy-поверненнями.
6. У звіті: файл:рядок першопричини, вивід RED-тесту до фіксу, вивід GREEN після, повний прогін `pytest tests/`.
