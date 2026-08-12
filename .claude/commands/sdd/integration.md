---
description: SDD Шаблон 4 — інтеграція зовнішнього сервісу/API. Ізоляція від гарячого шляху, round-trip верифікація.
argument-hint: <назва сервісу та протокол>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Виконай Шаблон 4 ("🔌 Інтеграція Сервісів / Протоколів") з `docs/for-agents/sdd-development-methodology.md` для задачі: $ARGUMENTS

1. Прочитай `docs/for-agents/sdd-development-methodology.md`, розділ "ШАБЛОН 4", і виконай його крок за кроком.
2. Прочитай реальний контракт сервісу (Swagger/OpenAPI, JSON-RPC тощо) — не вигадуй ендпоінти.
3. Адаптер МУСИТЬ працювати поза гарячим шляхом (ThreadPoolExecutor), з таймаутом на основі реальних замірів p95, і відсікати відмову сервісу за < 2мс без блокування циклу опитування.
4. Створи `scripts/verify_<service>_roundtrip.py` і `tests/regression/test_<service>_protocol.py`.
5. У звіті: контракт сервісу (джерело), значення таймауту і чому саме таке, результат round-trip скрипта, результат `pytest`.
