# Technical Plan: 013-impeccable-astryx-ui-overhaul

> **Feature:** `013-impeccable-astryx-ui-overhaul`  
> **Status:** Pending User Review & Approval  

---

## 🏗️ 1. Migration Map & Component Targets

1. **`SurveyOps.tsx` (P0 - Operations):**
   - Replace raw `div` wrappers with `Section`, `Card`, `HStack`, `VStack`, `StatusDot`, `Banner`, `ButtonGroup`.
   - Preserve precise percentage SVG bounding box overlays over screenshot cards.

2. **`RulesTable.tsx` (P0 - Rules & Mobile Layout):**
   - Replace raw `table` with `Table` & `ListItem` (mobile fallback).
   - Replace hardcoded `gridTemplateColumns: '1fr 420px'` with responsive layout & modal `Dialog`.
   - Render rule behavior and selectors in `CodeBlock`.

3. **`BrowserSourcesPanel.tsx` & `PatternsPanel.tsx` (P1 - Settings):**
   - Use `SegmentedControl`, `Switch`, `Card`, `StatusDot`, `TextInput`.

---

## 📊 2. System Ratio Target Metrics

- **System Component Ratio:** $0\% \rightarrow >85\%$
- **Token Efficiency:** $0\% \rightarrow >90\%$
- **Touch Target Minimum:** $24\text{px} \rightarrow 44\text{px}$
