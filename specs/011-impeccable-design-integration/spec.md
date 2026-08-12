# Feature Specification: 011-impeccable-design-integration

> **Feature:** `011-impeccable-design-integration`  
> **Status:** Pending User Approval (Phase 1 Complete / Phase 2 Blocked)  
> **Target Deliverables:**  
> - `.gitignore` (Ignore `.impeccable/live/`, temp previews, `*.png` artifacts)  
> - `PRODUCT.md` & `DESIGN.md` (Product vision & UI design tokens baseline)  
> - `.agents/skills/impeccable-design/` & `.claude/skills/impeccable-design/`  
> - Astryx React UI integration specs for `web/src/`  

---

## 🎯 1. Overview & Purpose

Feature `011-impeccable-design-integration` introduces the "Impeccable" UI design guidance system (`https://github.com/pbakaus/impeccable`) to `vydra-swiss-survey`. It aligns modern visual aesthetics (dark mode, glassmorphism, dynamic CSS tokens) with the Astryx React UI console in `web/src/`, while preserving all core project invariants (Hot Path < 5ms, SQLite WAL mode, PII protection).

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Git Ignore & Workspace Isolation
As a developer or agent, I want `.impeccable/` temp files, live previews, and image artifacts ignored in `.gitignore` so that git status remains clean.

#### Given / When / Then:
- **Given** `.gitignore` in workspace root,
- **When** Impeccable runs or generates preview images,
- **Then** `.impeccable/live/`, `.impeccable/cache/`, and temporary `*.png` artifacts are ignored by git.

### User Story 2: Product & Design Context Initialization
As an AI Agent (Agy / Claude), I need `PRODUCT.md` and `DESIGN.md` in workspace root to provide authoritative design tokens and UX invariants for Astryx UI components.

#### Given / When / Then:
- **Given** workspace root,
- **When** Impeccable design skills are invoked,
- **Then** `PRODUCT.md` specifies the survey automation console vision and `DESIGN.md` specifies color tokens, typography, dark mode glassmorphism, and responsive layout guidelines.

### User Story 3: Skill Mirroring for Agy and Claude Code
As an AI Agent, I need Impeccable design skills mirrored across `.agents/skills/impeccable-design/` and `.claude/skills/impeccable-design/` so that both agent runners can access design guidelines transparently.

#### Given / When / Then:
- **Given** `.agents/skills/` and `.claude/skills/`,
- **When** Impeccable skill files are installed,
- **Then** both agent environments resolve the skill cleanly.

---

## 🛡️ 3. Stop Criterion & Approval Gate

- **Phase 1 (Specification & Research):** Complete.
- **Phase 2 (Implementation & Code Modification):** STOP HERE. Await explicit user authorization before making any code modifications in `web/src/`, `.gitignore`, or root workspace files.
