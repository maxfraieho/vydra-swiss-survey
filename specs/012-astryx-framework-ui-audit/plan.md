# Technical Plan: 012-astryx-framework-ui-audit

> **Feature:** `012-astryx-framework-ui-audit`  
> **Status:** Active  

---

## 🏗️ 1. Component Refactoring Strategy

1. **`BrowserSourcesPanel.tsx`**:
   - Refactor to use Astryx `Card`, `Badge`, `StatusDot`, `Switch`, `HStack`, `VStack`, `Text`, `Heading`.
   - Display `priority` badge (e.g. `P1 - Primary`, `P2 - Fallback`) and `is_active` toggle switch.

2. **`test_astryx_ui_framework.py`**:
   - Integration test verifying presence of native Astryx imports in UI components and `specs/012` spec file.

3. **Verification**:
   - `bin/build_web.sh` -> `pytest` -> `bin/sdd_verify.sh`.
