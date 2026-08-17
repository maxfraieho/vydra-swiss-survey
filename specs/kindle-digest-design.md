# Design Doc — Kindle E-Ink Дайджест для SDD-телеметрії

> **Статус:** ДИЗАЙН, не імплементація. Реалізація — окрема SDD-фіча
> (`/sdd:feature`) після (a) підтвердження цього дизайну оператором,
> (b) Gmail OAuth від оператора. Базується на deep-research звіті
> "Optimizing Telemetry for Autonomous Software Engineering Agents"
> (2026-08-17, записник NotebookLM "Spec Kit").

## Навіщо

`scripts/sdd_llm_judge.py` (P8) працює в shadow mode — FAIL-вердикти
пишуться в лог, але НІКОГО не блокують і НІКОМУ не показуються.
Дайджест — відсутній споживач цієї інформації. Аналогічно
`.specify/feature.json` фіксує лише поточний знімок (`phase`), без
історії переходів. Дайджест закриває цей розрив: періодичний,
асинхронний канал зворотного зв'язку на пристрій, де оператор реально
його прочитає (не термінал, який він не дивиться постійно).

## §1. Джерела телеметрії — чесно, без вигаданого формату

| Джерело | Стан зараз | Розрив |
|---|---|---|
| `git log` / `--numstat` | ✅ живе | найбагатше джерело, брати першим |
| `.specify/feature.json` | ✅ живе, але **лише знімок** | нема історії — перезаписується на місці |
| `bin/sdd_verify.sh --gate` | ✅ живе | вивід лише в stdout, нічого не архівується |
| `scripts/sdd_llm_judge.py` вердикти | ✅ скрипт живий | **`logs/sdd_judge/` НЕ ІСНУЄ** — жодного вердикту ще не було (`SDD_JUDGE_KEY` не був сконфігурований до P8) |
| GitNexus impact/api_impact | ✅ MCP живий | on-demand, не архівується |

**Відновлення історії фаз без нового коду:** `git log -p --follow -- .specify/feature.json` реконструює кожен фазовий перехід заднім числом (автор+час) із наявної git-історії. Нуль нових записів, нуль ризику. Append-only `logs/sdd_phase_log.jsonl` — це Фаза 2 (додавання), не заміна.

**Мінімальні інструментальні доповнення (специфіковано, не імплементовано):**
- `sdd_verify.sh --json`: `{mode, missing, checks[], exit_code, ts}` → `logs/sdd_verify/<ts>.json`
- `sdd_llm_judge.py`: логувати SKIP-причини теж (не лише PASS/FAIL) — інакше shadow-режим невидимий, і його точність (для рішення T-149) неможливо оцінити
- Жодна зміна не чіпає гарячий шлях, жодна не змінює семантику exit-коду

## §2. Ієрархія контенту

1. **Master Executive Briefing** — активний `feature_id`, `phase`, `owner_agent`, `host`, коміти/файли/churn за вікно, максимальний Risk Score, один абзац narrative. Будь-який пункт з `R>=15` виноситься сюди.
2. **Semantic Spec Diffs** — diff `specs/<active>/{spec,plan,tasks}.md`, `.specify/constitution.md`, `AGENTS.md`, `.specify/feature.json`. Зміни політики — вище змін коду.
3. **Blast Radius Matrix** — `R = L × B` (Likelihood × Impact, 1-5 кожен). L — з 30-денного churn + наявність тестів + минулі judge-порушення. B — з GitNexus fan-in + належність до гарячого шляху (Інваріант 2) + PII-шляхи (Інваріант 1). `R>=15` — подвійна рамка.
4. **Phase Checklist** — `phases_done[]` як `[X]`, `phase` як поточна, незакриті `- [ ]` з `specs/*/tasks.md`. Включно з чесними відкритими пунктами (T-149, T-152/T-153) — не приховувати.
5. **Filtered High-Risk Diffs** — лише файли з `R>=10`, монохромний hanging-indent формат.

## §3. Каденція та тригери

| Рівень | Розклад | Джерело вікна | Розмір |
|---|---|---|---|
| Daily rollup | cron 06:00 dev-184 | 24г `git log` + `feature.json` diff за 24г + judge-логи дня | 5-10 стор |
| Weekly review | cron пʼятниця 16:00 | 7д агрегат + `phases_done` дельта + spec-drift + `- [ ]` борг | 15-25 стор |
| Instant | подія | одна подія | 1-2 стор |

Instant-умови (лише ті, що мають реальний детектор):
1. judge-вердикт `FAIL` у `logs/sdd_judge/` — **ключовий кейс**: арбітр у shadow mode, тому FAIL зараз нікого не блокує і ніхто його не бачить. Дайджест — єдиний споживач. Аргумент ЗА подовження shadow-періоду, не за скорочення.
2. `bin/sdd_verify.sh --gate` exit ≠ 0 (включно з mismatch `feature.json`.branch ↔ HEAD — реальний збій handoff-протоколу)
3. обчислений `R >= 15`
4. `>8` retry-loop, security/PII-порушення — **детектора ще немає**, задокументовано як майбутню інструменталізацію, не як робочу функцію

Групуючий ключ = `feature_id` з `feature.json` ("Unified Intent Vector"), не по-комітно.

## §4. Конвертер — дельти до `resume/md_to_epub.py`

База — наш вже робочий скрипт (`markdown`+`ebooklib`, без Calibre/pandoc), не форк з нуля.

| Зараз | Зміна |
|---|---|
| `background: #f0f0f0` на `pre`/`code` | Прибрати — сірий фон читається брудно на e-ink |
| `<pre><code>` для коду | `<p class="hanging-code-line">` + `span.diff-added` (bold+underline) / `span.diff-removed` (strikethrough) — `<pre>` НЕ переноситься на Kindle, обрізається за краєм |
| `h1 { page-break-before: always }` | вже правильно; додати `page-break-after/inside: avoid` на `h2`/`h3` (orphan prevention) |
| `set_identifier("urn:vydra-sdd-book:...")` | `urn:vydra-sdd-digest:<feature_id>:<ts>` |
| лише `--source` директорія `*.md` | додати single-file режим — дайджест генерується як один md |
| нема `<meta charset>` | додати явну UTF-8 декларацію — топ-причина відмов Send-to-Kindle парсера |

## §5. Відправка — лише інтерфейс, без коду

```
send_digest(epub_path: Path, subject: str, *, dry_run: bool = False) -> SendResult
  from: tukroschu@gmail.com   to: tukroschu@kindle.com
  attachment: <=25MB, .epub   body: порожнє (Amazon ігнорує)
  returns: {sent: bool, message_id: str|None, error: str|None}
```

**TODO/заблоковано:** Gmail OAuth від оператора — окрема задача. Два факти для фіксації: (1) відправник МУСИТЬ бути в Amazon Approved Personal Document E-mail List, інакше доставка мовчки дропається; (2) генерація дайджесту МУСИТЬ успішно завершуватись і архівуватись у `docs/digests/` **незалежно** від відправки — зламаний OAuth ніколи не має губити дайджест.

## §6. Chesterton's Fence

`docs/sdd-book/` (8 файлів) — не чіпати. Книга = one-time onboarding, написана людиною (мною). Дайджест = recurring status, машинно-згенерований. Різна вихідна директорія (`docs/digests/`), різний виклик конвертера (single-file + eink-профіль), різний identifier-namespace. Явний non-goal: дайджест ніколи не переписує і не замінює книгу.

## §7. Що далі

Це дизайн-документ, не набір SDD-артефактів. Імплементація → `specs/022-kindle-digest/` через `/sdd:feature` ПІСЛЯ (a) підтвердження дизайну оператором, (b) Gmail OAuth. Фаза 1 імплементації має бути read-only телеметрія (git log + `git log -p -- .specify/feature.json`) → EPUB → локальний файл; відправка і нове логування — пізніше.
