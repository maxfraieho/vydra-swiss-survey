---
name: speckit-teaching
description: >
  Specification-Driven Development (SDD) & Human-in-the-Loop (HITL) Teaching Skill for Vydra Swiss Survey Agent.
  Defines agent instructions for AntiGravity (agy), Claude, Agy, and Gemma visual agents.
  Covers text normalization, short token guards, 4-level scope isolation, structure_hash calculation,
  CoT JSON vision prompts, Telegram push notifications, and N>=3 empirical rule promotion gates.
---

# 🎓 Speckit Agent Teaching & Rule Authoring Skill

This skill defines the authoritative **Spec-Driven Teaching & Rule Authoring Paradigm** for `vydra-swiss-survey`. It instructs high-level AI agents (**AntiGravity / agy**, **Claude**, **Agy**, **Gemma**) how to execute survey passes, capture human overrides, author shadow rules, evaluate 4-level scope hierarchies, and promote verified rules.

---

## 🛠️ 1. SKILL INSTALLATION & USAGE

### 📍 Installation Paths
To install or activate this skill across agent environments:
* **Workspace (Antigravity & Agy):** `.agents/skills/speckit-teaching/SKILL.md`
* **Workspace (Claude Code):** `.claude/skills/speckit-teaching/SKILL.md`
* **Global Customizations Root:** `/home/.gemini/config/skills/speckit-teaching/SKILL.md`

### 🚀 Agent Invocation
Any AI agent taking surveys or modifying survey logic MUST read and apply this skill:
```bash
# In Antigravity / agy CLI or prompt:
view_file /data/data/com.termux/files/home/vydra-swiss-survey/.agents/skills/speckit-teaching/SKILL.md
```

---

## 🏛️ 2. CORE TEACHING INVARIANTS & RULES (P1–P5)

### 🔤 Invariant 1: Diacritics Normalization & Short Token Guard (P1)
- **NFD Normalization:** Normalize DOM element labels and target texts using NFD decomposition (`unicodedata.normalize('NFD')`) and German umlaut mapping (`ä`->`ae`, `ö`->`oe`, `ü`->`ue`, `ß`->`ss`).
- **Short Token Guard:** For tokens $\le 3$ characters (`oui`, `non`, `ja`, `nein`), fuzzy matching (Jaro-Winkler) is **DISABLED**. Enforce 100% strict equality.
- **Layering:** `cdp_client.py` handles element targeting normalization; `reflection.py` handles high-level outcome classification (`_find_phrase`).

### 🎓 Invariant 2: Visual Bounding Boxes & HITL Override (P2)
- **Relative % Bounding Boxes:** `cdp_client.py` captures element bounding boxes (`x`, `y`, `width`, `height` in %) relative to the active viewport screenshot.
- **Human Choice Precedence:** Human tutor overrides via `SurveyOps.tsx` SVG overlay take 100% precedence over vision model predictions.
- **Async Triage:** Failed session traces logged in `async_review_queue` are reviewed and converted to rules in 1 click.

### 🛡️ Invariant 3: 4-Level Scope Resolution & `structure_hash` (P3)
- **Structural Skeleton Hash (`structure_hash`):** SHA-256 hash of DOM element tag names, input types, aria roles, and hierarchy **EXCLUDING ALL QUESTION/ANSWER INNER TEXT**.
- **4-Level Scope Matching Cascade:**
  1. `EXACT_LAYOUT` (`host` + `provider_id` + `structure_hash`)
  2. `PROVIDER_PATTERN` (`provider_id` + `pattern`)
  3. `HOST_PATTERN` (`host` + `pattern`)
  4. `GLOBAL_PATTERN` (`*` + `pattern`)

### 🧠 Invariant 4: Zero-Hallucination CoT Vision Prompting (P4)
- **Chain-of-Thought JSON Schema:**
  ```json
  {
    "visual_analysis": "Short analysis of visible UI controls",
    "persona_matching": "Alignment of candidate choice with active persona rules",
    "action": "click" | "type" | "scroll" | "done",
    "target_text": "EXACT VISIBLE LABEL OR BUTTON TEXT (NEVER INVENT PIXEL COORDINATES)",
    "value": "text to type if action=type"
  }
  ```
- **Ground Truth Benchmark:** All prompt modifications must pass 10 benchmark test cases in `test_vision_cot_benchmark.py`.

### 🚑 Invariant 5: Self-Healing & Telegram Push Notifications (P5)
- **Captcha Signatures:** Detect `cf-turnstile`, `g-recaptcha`, `hcaptcha`, `geetest`.
- **Telegram Push Alert:** Trigger `notify_tutor_captcha_blocking()` via `@vydra_swiss_survey_bot` to post instant alerts into group `-4964233423`.
- **Session State:** Pause session in `waiting_captcha` state unless CLI flag `--no-recovery` is passed.

---

## 🔁 3. RULE LIFECYCLE & EMPIRICAL PROMOTION GATE

1. **Shadow Rule Authoring:** Recorded as `status='shadow'`, `wins=0`, `losses=0` via `record_host_rule()`.
2. **Outcome Attribution:** `bump_rule_outcome(rule_ids, outcome, run_id)` updates wins/losses and logs `rule_applications`.
3. **N >= 3 Promotion Gate:** `auto_promote_rules(min_unique_runs=3)` promotes shadow rules to `status='active'` ONLY when confirmed across $N \ge 3$ distinct `run_id` completed executions.
