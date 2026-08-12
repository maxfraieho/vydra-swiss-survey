# Feature Specification: 012-astryx-framework-ui-audit

> **Feature:** `012-astryx-framework-ui-audit`  
> **Status:** Active / Implementation Phase  
> **Target Deliverables:**  
> - Native `@astryxdesign/core` component integration across `web/src/screens/`  
> - `web/src/screens/settings/BrowserSourcesPanel.tsx` (Priority badges & fallback controls)  
> - Production bundle build verification (`bin/build_web.sh`)  

---

## 🎯 1. Overview & Purpose

Feature `012-astryx-framework-ui-audit` enforces the strict project invariant of using built-in `@astryxdesign/core` React components (`Card`, `Badge`, `StatusDot`, `Banner`, `Table`, `MetadataList`, `HStack`, `VStack`, `Switch`, `SegmentedControl`) throughout the Astryx Web UI console (`web/src/`), avoiding custom reinvented components.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Native Astryx Components Adoption
As a developer or agent, I want all UI screens in `web/src/screens/` to use native `@astryxdesign/core` components so that UI consistency and design system integrity are maintained.

#### Given / When / Then:
- **Given** `@astryxdesign/core` v0.3.0 in `web/node_modules/`,
- **When** `web/src/screens/` components render,
- **Then** layouts use `Card`, `Badge`, `StatusDot`, `HStack`, `VStack`, and `Table` from `@astryxdesign/core`.

### User Story 2: Fallback Browser Sources Panel Polish
As an operator, I want `BrowserSourcesPanel.tsx` to display active status badges, priority order indicators, and fallback controls using Astryx `Badge` and `Switch` components.

#### Given / When / Then:
- **Given** browser sources list from `/api/settings/browser-sources`,
- **When** `BrowserSourcesPanel.tsx` renders,
- **Then** each source displays a priority badge (P1, P2, P3) and an active toggle switch.

---

## 🛡️ 3. Invariants & Verification Requirements

1. **Build Integrity:** `bin/build_web.sh` MUST complete cleanly with 0 TypeScript/Vite errors.
2. **SDD Verification:** `bin/sdd_verify.sh` MUST verify `specs/012-astryx-framework-ui-audit/spec.md` and exit 0.
