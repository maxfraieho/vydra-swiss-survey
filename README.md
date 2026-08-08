# vydra-swiss-survey

Третій ексклюзивний GPU-режим на OnePlus 13 (Termux), поруч із **Vydra**
(переклад, `kindle-butch-gen`) і **кодинг-моделлю** (`Bonsai-27B-Q1_0`,
`~/llm-switch.sh`). Автоматично проходить опитування на швейцарських
сайтах, використовуючи локальну vision-модель **Gemma 3 4B** для
прийняття рішень і CDP-доступ до ізольованого Chrome-вікна на робочому
ноутбуці (`192.168.3.30`), яке йде через власний SOCKS5-проксі в
Швейцарії (`100.66.97.93:1080`) — див. `exodus-infra/sw-proxy/*.bat`.

## Як це працює

1. `bin/sync_profiles.sh` тягне персона-промпти (хто саме проходить
   опитування — Арно/Аннет) і креденшали сайтів з dev-сервера
   (`exodus-infra/profile/`) у локальний, НЕ git-трекований кеш
   (`~/.vydra-survey-profiles/`). PII ніколи не потрапляє в цей репозиторій.
2. `cdp_client.py` піднімає self-heal SSH-тунель до ноутбука (той самий
   патерн, що й `chrome-win-mcp.sh` на rpi3b) і говорить з Chrome напряму
   через Chrome DevTools Protocol — без Node/MCP-залежностей на телефоні.
3. `survey_agent.py`:
   - перевіряє, що жоден інший важкий процес не зайнятий (той самий
     `pgrep`-патерн, що й `kbg_web/app.py::_heavy_state()` і
     `llm-switch.sh::check_vydra_active()`);
   - логіниться на сайт (детерміновано, за відомими лейблами полів);
   - у циклі: скріншот → `vision.py` (Gemma) вирішує ЩО клікнути (текст
     лейбла, не координати) → `cdp_client.py` шукає елемент за текстом у
     DOM і клікає в обчислений центр bounding-box.
4. Одна ітерація циклу = рівно одна дія — стоп-правило "не поєднуй вибір
   відповіді і Continuer" виконується самою структурою циклу.

## Запуск

```bash
bin/sync_profiles.sh
python3 survey_agent.py --profile arno --url https://meinungsplatz.ch/
```

`--dry-run` зупиняє прогін замість кліку по тому, що виглядає як
фінальна кнопка Submit/Continuer — корисно для першої перевірки. За
замовчуванням реальна відправка (свідомий вибір Q).

## GPU / CPU

Vision-виклики спочатку йдуть через OpenCL GPU (`-ngl 99`) — те саме
`LD_LIBRARY_PATH`, що й `~/start-translation-server.sh`. Якщо перший
виклик падає (Android background killer тощо), агент назавжди
переходить на CPU (`-t 4`, без `-ngl`) до кінця цього прогону — точна
копія безпечного виклику з `kindle-butch-gen/bin/agent_editor.py`.
