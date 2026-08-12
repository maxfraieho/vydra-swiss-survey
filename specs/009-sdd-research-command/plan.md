# Technical Plan: 009-sdd-research-command

> **Feature:** `009-sdd-research-command`  
> **Status:** Active  

---

## 🏗️ 1. Deliverables Architecture

1. **`.claude/commands/sdd/research.md`**:
   - YAML frontmatter (`description`, `argument-hint`, `allowed-tools`).
   - Instruction to execute Template 6 ("🔬 Глибоке Дослідження") from `docs/for-agents/sdd-development-methodology.md`.

2. **`docs/for-agents/sdd-development-methodology.md`**:
   - Add **"ШАБЛОН 6: Глибоке Дослідження та Архітектурний Аналіз (Deep Architectural & Technical Research)"**.
   - Protocol steps:
     1. Local Code & Artifact Inspection (file:line citations).
     2. Identify Trade-offs & Constraints (performance, security, hot path).
     3. Generate Self-Contained Gemini Prompt Artifact (`docs/for-agents/prompts/gemini-research-<slug>.md`).
     4. Report prompt artifact path & instructions to the user.

3. **`tests/integration/test_sdd_research_command.py`**:
   - Validates `.claude/commands/sdd/research.md` frontmatter and method link.
   - Validates Template 6 existence in `docs/for-agents/sdd-development-methodology.md`.

4. **`bin/sdd_verify.sh`**:
   - Adds `.claude/commands/sdd/research.md` and `specs/009-sdd-research-command/spec.md` to `REQUIRED_SPECS`.
