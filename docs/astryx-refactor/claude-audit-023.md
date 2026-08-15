# Audit Report 023: Track B (UI Defects U1–U6)

## Track B: UI Defect Fixes & Verification

### Summary of Fixed Defects

| Defect ID | Description | Root Cause | Fix Applied | Verification Status |
|-----------|-------------|------------|-------------|---------------------|
| **U1** | Viewport zoom > 100% overflow pan scroll cut-off | `transform: scale(scale)` does not expand layout box dimensions; flexbox `flex-center` clipped edges | Migrated to CSS layout box scaling (`width: ${zoomPercent}%`, `minWidth: ${zoomPercent}%`) with conditional `overflow-auto` scrolling container. | **PASS** (Live CDP test at 270% zoom: `scrollWidth = 3386px`, `scrollLeft = 2132px`, full right/bottom edge reachable) |
| **U2** | Dead "✎ Виправити" button in Fullscreen / Focus mode | Button click was a silent no-op without UI form or payload generation | Integrated `ViewportCorrectionForm` inline in fullscreen/focus view. Dispatches structured `HumanCorrection` (`kind: 'override_click'`, `reason_code`, `override_value`, `note`) to `/api/survey/override`. | **PASS** (Live CDP & Vitest: Clicking "✎ Виправити" opens form with reason selector, inputs, and submit button) |
| **U3** | Timeline fake hardcoded `status: 'success'` | Step history mapping hardcoded `status: 'success'` for every line | Added `parseStepLine` with regex matching for errors (❌), warnings (⚠️), pauses (⏸️), skips (⏭️), corrections (✏️), timestamps `[HH:MM:SS]`, and status badges. | **PASS** (StepTimeline displays dynamic badges & timestamps) |
| **U4** | `stepTotal` missing / malformed in Viewport | `stepTotal` wasn't forwarded from survey status, display format lacked total | Extracted total steps from status data and formatted header counter as `Крок N / M`. | **PASS** (Live CDP & Vitest: displays `Крок 1 / 1`) |
| **U5** | `TextInput` onChange contract hack scattered in 13 files | Inconsistent event handling `(e as any)?.target?.value ?? ''` | Centralized `normalizeInputChange(val: unknown): string` in `primitives.tsx` and updated all 13 screens/panels. | **PASS** (0 scattered hacks remain; unit tests verify string & event extraction) |
| **U6** | Inconsistent Toast API (`toast()` vs `toast.show()`) | Core `@astryxdesign/core/Toast` expects `{ body, type }` while screens called `toast.show({ variant, title })`, causing runtime errors | Built universal `useAppToast` / `useToast` in `primitives.tsx` supporting both signatures and re-exported it across all components. | **PASS** (All screens use unified toast adapter without errors) |

---

### Verification Gates Evidence

#### Gate G3: Live CDP Zoom 270%+ Full scrollWidth
- **Endpoint**: `https://survey.exodus.pp.ua/ops`
- **CDP Host**: `192.168.3.184:9226` (Swiss-proxy browser via `.30`, cookie `astryx_k=oDWnckh7aaA8HOJiskM3uvvmUi7nQFX6`)
- **Metrics**:
  - `initialZoom`: `100%`
  - `zoomedLabel`: `270%`
  - `containerClientWidth`: `1254px`
  - `containerScrollWidth`: `3386px`
  - `innerRectWidth`: `3386px` (`width: 270%`, `minWidth: 270%`)
  - `scrollLeftReached`: `2132px` (`3386 - 1254 = 2132px`)
  - `canScrollRight`: `true`
  - `scrollCoversFullWidth`: `true`
- **Result**: **PASS**

#### Gate G4: Live CDP Fullscreen "Виправити" Correction Form
- **Endpoint**: `https://survey.exodus.pp.ua/ops?view=focus`
- **Action**: Clicked "✎ Виправити" button in expanded view
- **Metrics**:
  - `hasCorrectBtn`: `true`
  - `formOpened`: `true`
  - `formHasCancel`: `true`
  - `textareaCount`: `2` (override value + tutor note)
  - `reason_code` selector options: `wrong_element`, `bad_value`, `missed_captcha`, etc.
- **Result**: **PASS**

#### Gate G5: UI Invariants Check (`bin/ui_verify.sh`)
- `INV-1`: 0 HEX literals in `.tsx` -> **PASS**
- `INV-2`: `style={{` occurrences <= 17 (Found: 4) -> **PASS**
- `INV-3`: Max 250 lines per `.tsx` in `screens/` and `ops/` -> **PASS**
- `INV-7`: 0 `fontSize < 12px` in `.tsx` -> **PASS**
- `INV-8`: Agent contract schema and TypeScript definitions present -> **PASS**
- **Result**: **PASS (0 failures)**

#### Vitest Unit Suite
- `src/ops/Viewport.test.tsx`: 4 passed (U1, U2, U4, U5)
- `src/ops/ResumeTabCard.test.tsx`: 3 passed (G1, URL validation, submit)
- Total: 7 passed in 31.55s.
