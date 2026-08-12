# Feature Specification: 010-sdd-expanded-commands

> **Feature:** `010-sdd-expanded-commands`  
> **Status:** Active / Implementation Phase  
> **Target Deliverables:**  
> - `.claude/commands/sdd/clarify.md` (`/sdd:clarify` slash command)  
> - `.claude/commands/sdd/audit.md` (`/sdd:audit` slash command)  
> - `.claude/commands/sdd/verify.md` (`/sdd:verify` slash command)  
> - `docs/for-agents/sdd-development-methodology.md` (Templates 7, 8, 9)  

---

## 🎯 1. Overview & Purpose

Feature `010-sdd-expanded-commands` completes the SDD command suite expansion (from 6 to 9 slash commands), eliminating AI agent context pollution and specification drift (`spec-drift`). It adds three critical slash commands:
1. **`/sdd:clarify` (Template 7):** Interactive pre-specification blind spot analysis & assumptions formalization.
2. **`/sdd:audit` (Template 8):** Deep spec-drift audit comparing actual codebase AST/signatures against `specs/`.
3. **`/sdd:verify` (Template 9):** Comprehensive system verification (Constitution invariants, DB WAL, pytest suite, and deployment health).

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: `/sdd:clarify` Slash Command & Template 7
As a developer or agent, I want `/sdd:clarify` to execute Template 7 from `docs/for-agents/sdd-development-methodology.md` so that ambiguous requirements are clarified before writing `specs/`.

#### Given / When / Then:
- **Given** `.claude/commands/sdd/clarify.md` installed,
- **When** `/sdd:clarify <idea>` is executed,
- **Then** it points to Template 7 in `docs/for-agents/sdd-development-methodology.md`, asks 3-5 clarifying questions, and generates an `Assumptions I'm Making` section.

### User Story 2: `/sdd:audit` Slash Command & Template 8
As an audit engineer or agent, I want `/sdd:audit` to execute Template 8 from `docs/for-agents/sdd-development-methodology.md` so that spec-drift and signature discrepancies between code and `specs/` are identified.

#### Given / When / Then:
- **Given** `.claude/commands/sdd/audit.md` installed,
- **When** `/sdd:audit <module_or_spec>` is executed,
- **Then** it points to Template 8 in `docs/for-agents/sdd-development-methodology.md`, runs `scripts/check_gitnexus_impact.py`, and generates a Spec-Drift remediation table.

### User Story 3: `/sdd:verify` Slash Command & Template 9
As a systems engineer or agent, I want `/sdd:verify` to execute Template 9 from `docs/for-agents/sdd-development-methodology.md` so that all project specs, SQLite WAL modes, pytest suites, and deployment scripts are verified in one command.

#### Given / When / Then:
- **Given** `.claude/commands/sdd/verify.md` installed,
- **When** `/sdd:verify` is executed,
- **Then** it points to Template 9 in `docs/for-agents/sdd-development-methodology.md`, runs `bin/sdd_verify.sh`, `pytest`, and `deploy/verify_installation.sh`.

---

## 🛡️ 3. Invariants & Verification Requirements

1. **Path Correctness:** All new command files MUST reference `docs/for-agents/sdd-development-methodology.md` (reflecting the restructured `docs/` hierarchy).
2. **SDD Verification:** `bin/sdd_verify.sh` MUST verify that `specs/010-sdd-expanded-commands/spec.md`, `.claude/commands/sdd/clarify.md`, `.claude/commands/sdd/audit.md`, and `.claude/commands/sdd/verify.md` exist and exit with 0.
