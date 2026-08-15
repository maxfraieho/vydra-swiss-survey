# Implementation Plan: 020-ops-viewport-and-tabs

## 1. Architecture & Component Decomposition
1. **Agent Contract & Types**:
   - Schema: `specs/020-ops-viewport-and-tabs/contracts/agent_intent.schema.json` & `web/src/ops/agent_intent.schema.json`
   - Generated Types: `web/src/types/agent.ts` with runtime `validateAgentFrame`.
2. **UI Primitives & Token Layer**:
   - `web/src/ui/tokens.ts` (design system tokens)
   - `web/src/ui/primitives.tsx` (Astryx wrappers: StatusPill, DataList, KeyValueList, MasterDetail, FormGrid)
3. **Viewport Component (`web/src/ops/Viewport.tsx` + `useViewportMode.ts`)**:
   - Modes: `inline | focus | fullscreen` stored in URL search params `?view=`.
   - Top status bar: status pill, truncated URL, step counter, close/fullscreen toggle.
   - Bottom 1-tap action bar: Approve, Correct (with reason_code selector), Pause.
   - Canvas/SVG BBox highlight layer for `agent_intent.target_bbox`.
   - Element tap mode for human corrections returning normalized `0..1` coordinates.
   - Pinch-zoom and pan via touch events and CSS transforms without remounting `<img>`.
4. **Decomposition of `SurveyOps.tsx`**:
   - `web/src/ops/AttentionCard.tsx` (Zone 1: active decision / HITL prompt with reason_code)
   - `web/src/ops/AgentIntent.tsx` (confidence bar, action rationale)
   - `web/src/ops/StepTimeline.tsx` (Zone 2: step log, progress history)
   - `web/src/ops/LaunchForm.tsx` (modal / launch dialog)
   - `web/src/ops/RecentRuns.tsx` (Zone 3: last 5 runs list)
   - `web/src/ops/useTutorRelay.ts` (CDP relay hook for feature 018 compatibility)
   - `web/src/screens/ops/SurveyOps.tsx` (< 150 lines container composing the above)
5. **Information Architecture & Tabs**:
   - `web/src/shell/Nav.tsx`: 3 sections, 5 items (`/ops` default landing, `/traces`, `/rules`, `/report`, `/settings`).
   - Host Gate: embedded into `/settings` tab "Доступи" + inline banner on `/ops`.
   - Compare: triggered from `/traces` via multi-run selection.
   - Conflicts: counter badge on "Навички агента" + inline resolution in rule detail.

## 2. Machine Verification & Invariants
- `bin/ui_verify.sh`:
  - `INV-1`: 0 HEX in `web/src/**/*.tsx`
  - `INV-2`: `style={{` <= 40
  - `INV-3`: 0 `.tsx` files > 250 lines in `web/src/screens` & `web/src/ops`
  - `INV-7`: 0 `fontSize: 9px|10px|11px`
  - `INV-8`: typed agent contract
