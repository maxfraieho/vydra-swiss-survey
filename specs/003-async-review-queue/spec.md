# Специфікація модуля Async Review Queue (`specs/003-async-review-queue`)

> **Специфікація:** `specs/003-async-review-queue`  
> **Статус:** Активна специфікація  
> **Базовий файл:** `persona_graph_memory.py`, `survey_agent.py`

---

## 1. Функціональні вимоги

### 1.1 Автоматичне заповнення черги розбору
- При завершенні опитування в `record_run_trace()`, якщо `outcome != 'completed'`, рядок автоматично додається у `async_review_queue`.
- Зберігаються поля: `run_id`, `host`, `persona`, `outcome`, `reason`, `triage_category='pending'`, `status='pending'`.

### 1.2 Автоматичний тріаж через Qwen 2.5 (`auto_triage_pending_queue`)
- Асинхронний воркер зчитує `pending` записи та класифікує їх за 4 категоріями:
  1. `text_normalization_mismatch`
  2. `dom_structure_change`
  3. `navigation_timeout`
  4. `unclassified`
- Використовує окрему конфігурацію `TRIAGE_LLM_BASE_URL` (за дефолтом `http://127.0.0.1:11434/v1` або Tailscale IP).

### 1.3 Автопромоція N ≥ 3 унікальних `run_id` (`auto_promote_rules`)
- Теневі правила промотуються в `active` **виключно за наявності 3+ унікальних completed прогонів** у `rule_applications`.
