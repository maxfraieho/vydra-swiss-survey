# Feature Specification: 014-impeccable-official-ui-critique

> **Feature:** `014-impeccable-official-ui-critique`  
> **Status:** Active / Verified  
> **Target Deliverables:**  
> - Official Impeccable CLI integration (`npx -y impeccable install`)  
> - Impeccable doctor compliance (`No drift found`)  
> - Conforming `PRODUCT.md` (Schema 3.5.0, Positioning, Context, Evidence, Principles)  
> - Conforming `DESIGN.md` (Color tokens, Typography, Components guidance)  

---

## 🎯 1. Overview & Purpose

Feature `014-impeccable-official-ui-critique` validates the official Impeccable CLI installation (`npx -y impeccable install`), enforces design doctor compliance across workspace product/design records, and embeds active design anti-pattern detection hooks into `.claude/` and `.agents/`.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Official Impeccable CLI & Doctor Compliance
As a system developer, I want `node .claude/skills/impeccable/scripts/doctor.mjs` to execute cleanly without architectural drift or missing record sections.

#### Given / When / Then:
- **Given** Impeccable CLI skills installed in `.claude/skills/impeccable/`,
- **When** `doctor.mjs` executes,
- **Then** output confirms `No drift found. Every artifact matches what this version reads.`

### User Story 2: Conforming Product & Design Records
As an AI coding agent, I want `PRODUCT.md` and `DESIGN.md` to contain standard schema sections so that design synthesis tools receive normative guidelines.

#### Given / When / Then:
- **Given** `PRODUCT.md` and `DESIGN.md` in repository root,
- **When** analyzed by Impeccable CLI scripts,
- **Then** `PRODUCT.md` includes Positioning, Operating Context, Evidence on Hand, and Product Principles, while `DESIGN.md` includes Colors, Typography, and Components.

---

## 🛡️ 3. Invariants & Verification Requirements

1. **Doctor Verification:** `node .claude/skills/impeccable/scripts/doctor.mjs` MUST return exit 0 with "No drift found".
2. **Build Verification:** `bin/build_web.sh` MUST build production React bundle cleanly.
3. **SDD Verification:** `bin/sdd_verify.sh` MUST verify `specs/014-impeccable-official-ui-critique/spec.md` and exit 0.
