# Feature Specification: 009-sdd-research-command

> **Feature:** `009-sdd-research-command`  
> **Status:** Active / Implementation Phase  
> **Target Deliverables:**  
> - `.claude/commands/sdd/research.md` (`/sdd:research` slash command)  
> - `docs/for-agents/sdd-development-methodology.md` (Add "ШАБЛОН 6: Глибоке Дослідження та Архітектурний Аналіз")  
> - `templates/research_prompt_template.md` (Template for generated research prompts)  

---

## 🎯 1. Overview & Purpose

The `009-sdd-research-command` introduces a dedicated SDD slash command `/sdd:research <тема дослідження>` and Template 6 ("🔬 Глибоке Дослідження"). It enables operators and AI agents (`agy`, `claude`) to systematically prepare deep architectural or technical research tasks, generating a ready-to-run markdown research prompt artifact (e.g. `docs/for-agents/prompts/gemini-research-<slug>.md`) that can be executed directly via Gemini or subagent reasoning models.

---

## 📋 2. User Stories & Acceptance Criteria

### User Story 1: `/sdd:research` Slash Command Resolution
As a user or agent, I want to type `/sdd:research <тема дослідження>` so that Claude Code or Agy initiates Template 6 ("🔬 Глибоке Дослідження") from `docs/for-agents/sdd-development-methodology.md`.

#### Given / When / Then:
- **Given** `.claude/commands/sdd/research.md` is installed in `.claude/commands/sdd/`,
- **When** `/sdd:research` is invoked with arguments,
- **Then** it validates YAML frontmatter (`description`, `argument-hint`, `allowed-tools`) and points to Template 6 in `docs/for-agents/sdd-development-methodology.md`.

### User Story 2: SDD Template 6 (Deep Architectural Research Protocol)
As an AI Agent, I need Template 6 in `docs/for-agents/sdd-development-methodology.md` to define a step-by-step protocol for researching candidate solutions (inspecting current codebase, identifying trade-offs, outlining pros/cons, evaluating performance, and generating a self-contained Gemini prompt artifact).

#### Given / When / Then:
- **Given** an execution of Template 6,
- **When** the agent researches a feature or architecture topic,
- **Then** it creates a dedicated research prompt artifact in `docs/for-agents/prompts/gemini-research-<slug>.md` with explicit input data, code references (file:line), constraints, and expected output structure.

---

## 🛡️ 3. Invariants & Verification Requirements

1. **Spec-Drift Protection:** `.claude/commands/sdd/research.md` MUST point directly to `docs/for-agents/sdd-development-methodology.md` Section "ШАБЛОН 6" as single source of truth.
2. **Verification Check:** `bin/sdd_verify.sh` MUST check that `specs/009-sdd-research-command/spec.md` and `.claude/commands/sdd/research.md` exist and exit with code 0.
