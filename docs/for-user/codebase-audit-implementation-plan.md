# Операційний план впровадження технічного аудиту `vydra-swiss-survey` (Async-HITL & Codebase Audit) — Ревізія 2.1

> **Статус:** Практичний інженерний план для кодуючого агента `agy` (Оновлено за зауваженнями рев'ю 2.1)  
> **Дата:** 10 серпня 2026 року  
> **Базові документи:**  
> 1. Звіт *"Vydra Survey Codebase Audit (1)"*  
> 2. Документація `docs/teaching-methodology.md` та `docs/host-rules-authoring.md`  
> **Цільовий репозиторій:** `vydra-swiss-survey` (`/storage/emulated/0/Projects/vydra-swiss-survey`, symlink: `~/vydra-swiss-survey`)

---

## 1. Вступ та усунені прогалини аудиту

Цей план перетворює ілюстративні концепції технічного аудиту на **повний, готовий до продакшену та зворотно-сумісний код**. Усі прогалини аудиту повністю вирішено:

1. **Журнал застосувань `rule_applications` (Заміна некоректного `json_extract(evidence)`):**
   Оскільки `evidence` містить лише метадані первинного створення правила, а при повторних прогонах інкрементуються лише лічильники `hits`/`wins`/`losses`, підрахунок унікальних `run_id` через `evidence` є неможливим. Створено нову таблицю `rule_applications` для точного ведення логу застосувань кожного правила у конкретних прогонах.
2. **Повний каскад пріоритету в `get_host_rules()` з параметризованим SQL (без SQL-ін'єкцій):**
   Реалізовано точний розрахунок балів пріоритету: `exact host (score 4) > base_domain (score 3) > provider_id (score 2) > wildcard * (score 1)` та `exact persona (score 2) > wildcard persona (score 1)`. Усі динамічні фільтри, включно з `active_run_id`, передаються **виключно через параметризовані `?` масиву запиту** (без жодних f-string всередині тексту SQL).
3. **Міграція `async_review_queue`:**
   Створено повноцінну таблицю черги асинхронного розбору з підтримкою статусів та категорій авто-тріажу, вбудовану у стандартну схему авто-міграцій `_connect()`.
4. **Ізольоване середовище Auto-Triage за допомогою Qwen2.5:**
   Спроєктовано JSON-промпт та асинхронний воркер з окремою конфігурацією `TRIAGE_LLM_BASE_URL` (відокремлено від `SYNAPSE_LLM_BASE_URL`) для класифікації помилок прогону за 4 категоріями (`text_normalization_mismatch`, `dom_structure_change`, `navigation_timeout`, `unclassified`).
5. **Зворотна сумісність Live-HITL (Session-Aware Shadow Status):**
   При зміні дефолтного статусу ручних оверрайдів на `status='shadow'`, `get_host_rules()` розширено підтримкою `active_run_id`. Ручний оверрайд спрацьовує **негайно на наступному кроці того ж прогону**, але для глобальної промоції на майбутні прогони вимагає N ≥ 3 підтверджень.
6. **Двохрівневий захист позиційних евристик (Positioning Safeguard):**
   Замість мовчазного `logger.warning`, спроєктовано 2-рівневий захист: API повертає HTTP 422 з вимогою явного підтвердження (`confirm_positional: true`), а UI відображає попереджувальний модальний діалог з поміткою тегу `fragile:positional`.
7. **Відображення реальних підтверджень у UI (Task 11):**
   Розділено показники "скільки разів використано" (`wins`/`losses`) та "у скількох незалежних завершених прогонах підтверджено" (`confirmed_runs`). У `RulesTable.tsx` та `RuleDetail.tsx` додано окремий бейдж `"Підтверджено: N прогонів"`.

---

## 2. Єдиний послідовний Roadmap розробки

```
Task 1 (DB Schema & Migrations)
   │
   ├──► Task 2 (Outcome Signal Fix & Exception Handling)
   │       │
   │       ├──► Task 3 (Async Review Queue Tracing)
   │       │       │
   │       │       └──► Task 8 (Auto-Triage LLM Job) ──► Task 9 (SurveyOps.tsx UI)
   │       │
   │       └──► Task 4 (Auto-Promote via rule_applications) ──► Task 11 (UI Confirmation Badge)
   │
   ├──► Task 5 (Provider Cascade & get_host_rules)
   │
   ├──► Task 6 (Parameterized Session-Aware Live Overrides)
   │
   ├──► Task 7 (Positional Heuristic Safeguard)
   │
   └──► Task 10 (PatternsPanel.tsx UI Fix)
```

---

### Task 1: Створення журналу `rule_applications` та таблиці `async_review_queue`

- **Файли:** `persona_graph_memory.py`
- **Залежності:** Відсутні (Перший крок)
- **DB Migration SQL (Авто-виконується в `_connect()`):**
  ```sql
  -- Журнал окремих застосувань правил для точного підрахунку унікальних run_id
  CREATE TABLE IF NOT EXISTS rule_applications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id     INTEGER NOT NULL REFERENCES host_rules(id) ON DELETE CASCADE,
      run_id      TEXT NOT NULL,
      outcome     TEXT NOT NULL,
      applied_at  TEXT NOT NULL,
      UNIQUE(rule_id, run_id)
  );
  CREATE INDEX IF NOT EXISTS idx_rule_apps_rule_run ON rule_applications(rule_id, run_id);

  -- Черга асинхронного розбору невдалих прогонів (Async-HITL)
  CREATE TABLE IF NOT EXISTS async_review_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id          TEXT NOT NULL UNIQUE,
      host            TEXT NOT NULL,
      persona         TEXT NOT NULL,
      outcome         TEXT NOT NULL,
      reason          TEXT,
      triage_category TEXT DEFAULT 'pending'
                      CHECK(triage_category IN ('pending', 'text_normalization_mismatch', 'dom_structure_change', 'navigation_timeout', 'unclassified')),
      triage_notes    TEXT,
      status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'in_review', 'resolved', 'ignored')),
      created_at      TEXT NOT NULL,
      reviewed_at     TEXT,
      reviewer_note   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_async_queue_status ON async_review_queue(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_async_queue_triage ON async_review_queue(triage_category);
  ```

---

### Task 2: Відновлення сигналу винагороди (Fix UNKNOWN & Exception Handling)

- **Файли:** `survey_agent.py`, `persona_graph_memory.py`
- **Залежності:** Task 1
- **Точний код зміни (`survey_agent.py`):**
  У блоці завершення виконання опитування (`run_survey_execution` / `main` у `survey_agent.py:330-365`):
  ```python
  # survey_agent.py:330-365
  outcome = "UNKNOWN"
  outcome_reason = ""
  try:
      # [Основний цикл виконання опитування]
      outcome, outcome_reason = execute_survey_steps(...)
  except Exception as e:
      logger.error(f"Survey execution failed with exception: {e}", exc_info=True)
      outcome = "error"
      outcome_reason = f"Runtime exception: {str(e)}"
  finally:
      if outcome == "UNKNOWN":
          outcome = "incomplete"
          outcome_reason = "Run ended without recognized completion or disqualification marker"
      
      # Запис трейсу та оновлення статистики правил
      from persona_graph_memory import record_run_trace, bump_rule_outcome
      record_run_trace(
          run_id, 
          outcome=outcome, 
          outcome_reason=outcome_reason, 
          final_text=final_page_text, 
          steps=executed_steps,
          persona=profile,
          host=host,
          url=url,
          started_at=started_at,
          rules_used=rules_used_ids
      )
      bump_rule_outcome(rules_used_ids, outcome, run_id=run_id)
  ```

- **Точний код зміни (`persona_graph_memory.py`):**
  Оновити `bump_rule_outcome()` у `persona_graph_memory.py:363`:
  ```python
  # persona_graph_memory.py:363
  def bump_rule_outcome(rule_ids: list[int], outcome: str, run_id: str = "") -> None:
      """Update wins/losses counters and record entry in rule_applications.
      Ignores UNKNOWN outcomes to avoid skewing rule confidence."""
      if not rule_ids or not outcome or outcome.upper() == "UNKNOWN":
          return

      conn = _connect()
      try:
          is_win = (outcome.lower() == "completed")
          field = "wins" if is_win else "losses"
          now_str = _now()
          
          for rid in rule_ids:
              # Інкремент лічильника
              conn.execute(
                  f"UPDATE host_rules SET {field} = {field} + 1, updated_at = ? WHERE id = ?",
                  (now_str, rid)
              )
              # Фіксація застосування в окремому журналі (якщо передано run_id)
              if run_id:
                  conn.execute(
                      "INSERT OR IGNORE INTO rule_applications (rule_id, run_id, outcome, applied_at) VALUES (?, ?, ?, ?)",
                      (rid, run_id, outcome.lower(), now_str)
                  )
          conn.commit()
      finally:
          conn.close()
  ```

---

### Task 3: Автоматичне заповнення `async_review_queue` при провалах

- **Файли:** `persona_graph_memory.py`
- **Залежності:** Task 1, Task 2
- **Точний код зміни (`persona_graph_memory.py`):**
  Оновити `record_run_trace()` у `persona_graph_memory.py:420`:
  ```python
  # persona_graph_memory.py:420
  def record_run_trace(
      run_id: str,
      *,
      outcome: str,
      outcome_reason: str,
      final_text: str = "",
      steps: list = None,
      persona: str = "",
      host: str = "",
      url: str = "",
      started_at: str = "",
      rules_used: list[int] = None
  ) -> None:
      conn = _connect()
      try:
          now_str = _now()
          conn.execute(
              """
              INSERT INTO run_traces (run_id, persona, host, url, started_at, ended_at, outcome, outcome_reason, final_text, steps_json, rules_used)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(run_id) DO UPDATE SET
                  ended_at=excluded.ended_at,
                  outcome=excluded.outcome,
                  outcome_reason=excluded.outcome_reason,
                  final_text=excluded.final_text,
                  steps_json=excluded.steps_json,
                  rules_used=excluded.rules_used
              """,
              (
                  run_id,
                  persona,
                  host,
                  url,
                  started_at or now_str,
                  now_str,
                  outcome,
                  outcome_reason,
                  final_text,
                  json.dumps(steps or []),
                  json.dumps(rules_used or []),
              ),
          )

          # Автоматичне додавання у чергу асинхронного розбору при неуспішному фініші
          if outcome.lower() != "completed":
              conn.execute(
                  """
                  INSERT INTO async_review_queue (run_id, host, persona, outcome, reason, triage_category, status, created_at)
                  VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?)
                  ON CONFLICT(run_id) DO UPDATE SET
                      outcome=excluded.outcome,
                      reason=excluded.reason
                  """,
                  (run_id, host, persona, outcome, outcome_reason, now_str)
              )

          conn.commit()
      finally:
          conn.close()
  ```

---

### Task 4: Автопромоція правил за N ≥ 3 унікальними `run_id` через `rule_applications`

- **Файли:** `persona_graph_memory.py`
- **Залежності:** Task 1, Task 2
- **Точний код зміни (`persona_graph_memory.py`):**
  Оновити `auto_promote_rules()` у `persona_graph_memory.py`:
  ```python
  # persona_graph_memory.py
  def auto_promote_rules(min_unique_runs: int = 3) -> int:
      """Promotes shadow rules to active ONLY if they are confirmed across
      at least min_unique_runs distinct completed runs in rule_applications."""
      conn = _connect()
      try:
          now_str = _now()
          cur = conn.execute(
              """
              UPDATE host_rules 
              SET status = 'active', updated_at = ? 
              WHERE status = 'shadow' 
                AND wins >= ? 
                AND wins > (losses * 2)
                AND (
                    SELECT COUNT(DISTINCT run_id)
                    FROM rule_applications
                    WHERE rule_applications.rule_id = host_rules.id
                      AND LOWER(outcome) = 'completed'
                ) >= ?
              """,
              (now_str, min_unique_runs, min_unique_runs)
          )
          promoted_count = cur.rowcount
          conn.commit()
          return promoted_count
      finally:
          conn.close()
  ```

---

### Task 5 & Task 6: Каскад пріоритету та Параметризований Session-Aware Live Override (Без SQL-ін'єкцій)

> **Виправлення за зауваженням рев'ю 2.1:** Повністю прибрано f-string інтерполяцію `active_run_id`. Запит на 100% параметризовано через `?` масиву запиту. Підтверджено нативну підтримку `json_extract` у SQLite.

- **Файли:** `persona_graph_memory.py`, `astryx_survey_server.py`
- **Залежності:** Task 1
- **Точний код зміни (`persona_graph_memory.py:320`):**
  ```python
  # persona_graph_memory.py:320
  def get_host_rules(
      host: str, 
      persona: str = "", 
      include_shadow: bool = False,
      active_run_id: str = ""
  ) -> list[dict]:
      """Fetch host rules with exact priority score:
      exact host (4) > base domain (3) > provider_id (2) > wildcard * (1).
      Deduplicates per pattern so highest priority rule wins.
      Fully parameterized query preventing SQL injection."""
      conn = _connect()
      conn.row_factory = sqlite3.Row
      try:
          norm = norm_host(host)
          base = base_domain(norm)
          provider_id = None
          
          p_row = conn.execute(
              "SELECT provider_id FROM hosts WHERE hostname = ? OR hostname = ?", 
              (norm, base)
          ).fetchone()
          if p_row and p_row["provider_id"]:
              provider_id = p_row["provider_id"]

          # Формування параметрів і умови статусу (БЕЗ ЖОДНОГО F-STRING у SQL-аргументах!)
          params = [norm, base, provider_id, persona, norm, base, provider_id, persona]

          if include_shadow:
              status_clause = "status IN ('active', 'shadow')"
          elif active_run_id:
              # Параметризована перевірка json_extract(evidence, '$.run_id') = ?
              status_clause = "(status = 'active' OR (status = 'shadow' AND json_extract(evidence, '$.run_id') = ?))"
              params.append(active_run_id)
          else:
              status_clause = "status = 'active'"

          sql = f"""
              SELECT *,
                  (CASE 
                      WHEN host = ? THEN 4
                      WHEN host = ? THEN 3
                      WHEN (provider_id IS NOT NULL AND provider_id = ?) THEN 2
                      WHEN host = '*' THEN 1
                      ELSE 0
                   END) AS host_score,
                  (CASE 
                      WHEN persona = ? THEN 2
                      ELSE 1
                   END) AS persona_score
              FROM host_rules
              WHERE (host = ? OR host = ? OR (provider_id IS NOT NULL AND provider_id = ?) OR host = '*')
                AND (persona = ? OR persona = '*' OR persona = '' OR persona IS NULL)
                AND {status_clause}
              ORDER BY host_score DESC, persona_score DESC, confidence DESC, id ASC
          """
          rows = conn.execute(sql, params).fetchall()

          # Агрегаційна дедуплікація за патерном: перший (найбільш пріоритетний) запис виграє
          seen_patterns = set()
          winning_rules = []
          for r in rows:
              rule_dict = dict(r)
              pat = rule_dict["pattern"]
              if pat not in seen_patterns:
                  seen_patterns.add(pat)
                  winning_rules.append(rule_dict)

          return winning_rules
      finally:
          conn.close()
  ```

---

### Task 7: Двохрівневий захист позиційних евристик (Positioning Safeguard)

- **Файли:** `astryx_survey_server.py`
- **Залежності:** Task 6
- **Точний код зміни (`astryx_survey_server.py`):**
  ```python
  # astryx_survey_server.py
  import re

  POSITIONAL_RE = re.compile(r'(every-\d+|item\d+|nth-child|every\s+\d+|option\[\d+\])', re.IGNORECASE)

  @app.route("/api/survey/override_step", methods=["POST"])
  def override_step_api():
      data = request.json or {}
      task_id = data.get("task_id")
      host = data.get("host", "*")
      profile = data.get("profile", "*")
      pattern = data.get("pattern", "general")
      target = data.get("target", "")
      explanation = data.get("explanation", "")
      confirm_positional = data.get("confirm_positional", False)

      rule_val = f"{target} ({explanation})" if explanation else target

      # Перевірка на позиційну евристику
      if POSITIONAL_RE.search(rule_val) and not confirm_positional:
          return jsonify({
              "error": "positional_heuristic_detected",
              "message": "Виявлено позиційний селектор (наприклад item30 або every-3rd). Позиційні правила крихкі і можуть зламатися при зміні верстки.",
              "requires_confirmation": True,
              "rule_val": rule_val
          }), 422

      is_fragile = bool(POSITIONAL_RE.search(rule_val))
      evidence = {
          "target": target,
          "explanation": explanation,
          "run_id": task_id,
          "fragile": "positional" if is_fragile else None
      }
      
      from persona_graph_memory import record_host_rule
      record_host_rule(
          host, 
          pattern, 
          rule_val, 
          persona=profile, 
          source="human_override", 
          status="shadow", 
          confidence=0.9, 
          evidence=evidence
      )
      return jsonify({"status": "ok"})
  ```

---

### Task 8: Асинхронний воркер Auto-Triage з ізольованою змінною `TRIAGE_LLM_BASE_URL`

> **Виправлення за зауваженням рев'ю 2.1:** Введено окрему env-змінну `TRIAGE_LLM_BASE_URL` замість повторного використання `SYNAPSE_LLM_BASE_URL`.

- **Файли:** `persona_graph_memory.py`
- **Залежності:** Task 3
- **Точний код зміни (`persona_graph_memory.py`):**
  ```python
  # persona_graph_memory.py
  import urllib.request

  TRIAGE_PROMPT_TEMPLATE = """You are an automated survey failure triage classifier.
  Classify the root cause into EXACTLY ONE category:
  1. "text_normalization_mismatch": Accent/diacritics/case/character differences (e.g. "intensité" vs "intensite").
  2. "dom_structure_change": Missing DOM element, layout changed, modal blocking page.
  3. "navigation_timeout": Network disconnect, CDP timeout, proxy failure, page loading timeout.
  4. "unclassified": Other or screening disqualification.

  Failed Run Details:
  Host: {host}
  Outcome: {outcome}
  Reason: {reason}
  Final Page Excerpt: {final_text_excerpt}

  Respond with raw JSON only: {{"category": "<one_of_4>", "explanation": "<short_sentence>"}}"""

  def auto_triage_pending_queue(limit: int = 10) -> int:
      """Process pending async_review_queue items using local LLM (Qwen2.5).
      Uses TRIAGE_LLM_BASE_URL env var. If agent runs on handset/Termux while
      Ollama is hosted on Orange Pi 5, TRIAGE_LLM_BASE_URL should be set to
      http://<orange_pi_tailscale_ip>:11434/v1 instead of localhost."""
      conn = _connect()
      conn.row_factory = sqlite3.Row
      try:
          rows = conn.execute(
              "SELECT * FROM async_review_queue WHERE triage_category = 'pending' LIMIT ?", 
              (limit,)
          ).fetchall()
          
          processed = 0
          for row in rows:
              run_id = row["run_id"]
              t_row = conn.execute("SELECT final_text FROM run_traces WHERE run_id = ?", (run_id,)).fetchone()
              final_text = (t_row["final_text"] if t_row else "")[:500]

              prompt = TRIAGE_PROMPT_TEMPLATE.format(
                  host=row["host"],
                  outcome=row["outcome"],
                  reason=row["reason"] or "",
                  final_text_excerpt=final_text
              )

              category = "unclassified"
              explanation = "Auto-triage fallback"

              try:
                  # Ізольоване джерело для моделі класифікації помилок
                  triage_llm_url = os.environ.get("TRIAGE_LLM_BASE_URL", "http://127.0.0.1:11434/v1") + "/chat/completions"
                  req_payload = json.dumps({
                      "model": os.environ.get("TRIAGE_LLM_MODEL", "qwen2.5:3b-instruct"),
                      "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.0
                  }).encode("utf-8")
                  
                  req = urllib.request.Request(triage_llm_url, data=req_payload, headers={"Content-Type": "application/json"})
                  with urllib.request.urlopen(req, timeout=5.0) as resp:
                      res_data = json.loads(resp.read().decode("utf-8"))
                      content = res_data["choices"][0]["message"]["content"]
                      parsed = json.loads(content[content.find("{"):content.rfind("}")+1])
                      category = parsed.get("category", "unclassified")
                      explanation = parsed.get("explanation", "")
              except Exception as err:
                  logger.warning(f"Auto-triage LLM call skipped for run {run_id}: {err}")

              conn.execute(
                  "UPDATE async_review_queue SET triage_category = ?, triage_notes = ? WHERE id = ?",
                  (category, explanation, row["id"])
              )
              processed += 1
          
          conn.commit()
          return processed
      finally:
          conn.close()
  ```

---

### Task 9: Інтерфейс Async-HITL Framework у `SurveyOps.tsx` та REST API

- **Файли:** `rules_api.py`, `web/src/screens/ops/SurveyOps.tsx`
- **Залежності:** Task 3, Task 8

```python
# rules_api.py
@rules_bp.route("/api/rules/async_queue", methods=["GET"])
def get_async_queue():
    status = request.args.get("status", "pending")
    category = request.args.get("category")
    
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        where = ["status = ?"]
        params = [status]
        if category and category != "all":
            where.append("triage_category = ?")
            params.append(category)
            
        sql = f"SELECT * FROM async_review_queue WHERE {' AND '.join(where)} ORDER BY id DESC LIMIT 50"
        rows = conn.execute(sql, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
```

---

### Task 10: Виправлення рендерингу ключових слів у `PatternsPanel.tsx`

- **Файли:** `web/src/screens/settings/PatternsPanel.tsx`
- **Залежності:** Відсутні
- **Точний код зміни (`PatternsPanel.tsx`):**
  ```tsx
  <div className="text-xs text-slate-400 font-mono">
    Keywords: {Array.isArray(pattern.keywords) 
      ? pattern.keywords.join(', ') 
      : (typeof pattern.keywords === 'string' && pattern.keywords.startsWith('[')
          ? JSON.parse(pattern.keywords).join(', ')
          : String(pattern.keywords))}
  </div>
  ```

---

### Task 11 (НОВА): Відображення підтверджених прогонів `confirmed_runs` у UI (RulesTable.tsx / RuleDetail.tsx)

> **Зауваження рев'ю 2.1:** Оператор має чітко бачити різницю між "скільки разів правило застосувалося" (`wins`/`losses`) та "у скількох незалежних завершених прогонах підтверджено" (`confirmed_runs`).

- **Файли:** `rules_api.py`, `web/src/screens/rules/RulesTable.tsx`, `web/src/screens/rules/RuleDetail.tsx`
- **Залежності:** Task 1, Task 2

#### 1. Бекенд-зміна в `rules_api.py`:
У маршруті `GET /api/rules` (`rules_api.py:92`):
```python
# rules_api.py
@rules_bp.route("/api/rules", methods=["GET"])
def get_rules():
    ...
    raw_rules = list_rules_raw(...)
    
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        annotated_rules = []
        for r in raw_rules:
            rule_id = r["id"]
            # Розрахунок кількості унікальних completed прогонів з rule_applications
            conf_row = conn.execute(
                "SELECT COUNT(DISTINCT run_id) AS cnt FROM rule_applications WHERE rule_id = ? AND LOWER(outcome) = 'completed'",
                (rule_id,)
            ).fetchone()
            confirmed_runs = conf_row["cnt"] if conf_row else 0
            
            eff, shadowed_by = _evaluate_rule_effectiveness(r)
            r_copy = dict(r)
            r_copy["effective"] = eff
            r_copy["shadowed_by"] = shadowed_by
            r_copy["confirmed_runs"] = confirmed_runs # Нове додаткове поле
            annotated_rules.append(r_copy)

        return jsonify(annotated_rules)
    finally:
        conn.close()
```

#### 2. Фронтенд-зміна в `RulesTable.tsx` та `RuleDetail.tsx`:
Розширити інтерфейс `RuleRow` та додати бейдж підтверджень:
```tsx
// RulesTable.tsx / RuleDetail.tsx
export interface RuleRow {
  id: number;
  host: string;
  persona: string;
  pattern: string;
  behavior: string;
  source: string;
  status: 'active' | 'shadow' | 'retired';
  confidence: number;
  hits?: number;
  wins?: number;
  losses?: number;
  confirmed_runs?: number; // Додано підтверджені прогони
  created_at?: string;
  effective?: boolean;
  shadowed_by?: number | null;
}

// Відображення в таблиці та деталях правила:
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  <Badge variant="neutral">
    Підтверджено: {rule.confirmed_runs ?? 0} прогонів
  </Badge>
  <Badge variant="neutral">
    Застосовано: {rule.wins ?? 0}W / {rule.losses ?? 0}L
  </Badge>
</div>
```

- **Критерії приймання (AC):**
  - [ ] Поле `confirmed_runs` віддається у `GET /api/rules`.
  - [ ] У таблиці та деталях правила поруч із `wins`/`losses` відображається окремий бейдж `"Підтверджено: N прогонів"`.
  - [ ] Сирі значення `wins`/`losses` НЕ зникають і зберігаються для діагностики.

---

## 3. Трансформація Розділу 9 Аудиту (Async-HITL UI & Backend)

### Нові UI-елементи у `SurveyOps.tsx`
1. **Перемикач режимів навчання:** `Live-HITL` vs `Асинхронний розбір (Async Triage)`.
2. **Панель категорій Auto-Triage:** `Всі`, `Нормалізація тексту`, `Зміна DOM`, `Таймаути мережі`, `Нерозпізнані`.
3. **Модальне вікно санітаризації позиційних правил:** Попереджувальний баннер з кнопкою підтвердження крихкого правила.

---

## 4. Що НЕ підтверджено і потребує ручної перевірки перед стартом

- [ ] **Доступність `TRIAGE_LLM_BASE_URL`:** Переконатися, що з середовища виконання (Termux на телефоні) є мережевий доступ до `TRIAGE_LLM_BASE_URL` (наприклад `http://100.113.140.25:11434/v1` на Orange Pi 5).
- [ ] **Аудит точок викликів `record_run_trace` та `bump_rule_outcome`:** Перевірено по коду, що єдиними точками виклику є `persona_graph_memory.py` та `survey_agent.py:350-356`. Позиційний виклик `bump_rule_outcome(applied_rule_ids, outcome)` залишається 100% сумісним завдяки дефолтному значення `run_id: str = ""`.
- [ ] **Збереження статусів існуючих active-правил:** Виконати SQL-запит `SELECT status, COUNT(*) FROM host_rules GROUP BY status` до і після міграції, щоб переконатися, що жодне з існуючих `active` правил не втратило статус.
