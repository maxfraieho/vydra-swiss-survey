# Feature Specification: 013-impeccable-astryx-ui-overhaul

> **Feature:** `013-impeccable-astryx-ui-overhaul`  
> **Status:** Pending User Review & Step-by-Step Approval  
> **Target Deliverables:**  
> - Native `@astryxdesign/core` component migration (>85% System Ratio)  
> - Touch target size $\ge$ 44px across interactive elements  
> - Dark mode glassmorphism UI overhaul (`web/src/screens/`)  
> - `PRODUCT.md` & `DESIGN.md` token synchronization  

---

## 🎯 1. Overview & Purpose

Feature `013-impeccable-astryx-ui-overhaul` executes the architectural UI overhaul specified in `/storage/emulated/0/Download/Аудит компонентів Astryx Framework.txt`. It replaces hardcoded inline styles and raw HTML containers across all 18 Astryx React console screens (`web/src/`) with native `@astryxdesign/core` components (`AppShell`, `Card`, `Section`, `Table`, `Badge`, `StatusDot`, `Banner`, `SegmentedControl`, `Switch`, `CodeBlock`), achieving >85% system ratio and 44px touch targets.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Operation Console Refactoring (`SurveyOps.tsx`)
As an operator, I want `SurveyOps.tsx` to render using native Astryx `Card`, `Section`, `HStack`, `VStack`, `StatusDot`, `Banner`, and `ButtonGroup` components so that live survey traces and HITL actions display cleanly with 44px touch targets.

#### Given / When / Then:
- **Given** active survey session in `SurveyOps.tsx`,
- **When** state updates (running, waiting_auth, waiting_verification),
- **Then** status renders via `StatusDot` & `Badge`, HITL corrections display in a native `Banner`, and action buttons use 44px `Button`/`IconButton` targets.

### User Story 2: Rules Management & Responsive Mobile Layout (`RulesTable.tsx`)
As a tutor, I want `RulesTable.tsx` to use native `Table`, `Badge`, `MetadataList`, and `CodeBlock` components, and render details in a modal `Dialog` on narrow mobile screens (<480px) to prevent horizontal scrolling.

#### Given / When / Then:
- **Given** rules list in `RulesTable.tsx`,
- **When** viewed on mobile screens (<480px) or desktop,
- **Then** rule selectors display in a styled `CodeBlock`, rule statuses display in colored `Badge`s, and rule details display in a responsive modal `Dialog`.

### User Story 3: Settings & Pattern Management (`BrowserSourcesPanel.tsx` & `PatternsPanel.tsx`)
As a systems administrator, I want settings panels to use `SegmentedControl`, `Switch`, `Card`, and `StatusDot` for toggle controls and configuration options.

#### Given / When / Then:
- **Given** settings panels,
- **When** switching options or configuring proxy/CDP sources,
- **Then** state transitions smoothly using `SegmentedControl` and `Switch`.

---

## 🛡️ 3. Approval Gate & Verification

1. **Step-by-Step Approval:** User reviews generated visual UI mockups (`ops_console_mockup`, `rules_manager_mockup`, `settings_panel_mockup`), spec, and plan before proceeding to full code refactoring.
2. **Build Verification:** `bin/build_web.sh` MUST complete cleanly with 0 errors.
3. **SDD Verification:** `bin/sdd_verify.sh` MUST verify `specs/013-impeccable-astryx-ui-overhaul/spec.md` and exit 0.
