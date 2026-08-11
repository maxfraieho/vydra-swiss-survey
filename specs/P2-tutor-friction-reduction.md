# Phase P2: HITL Tutor Friction Reduction Spec

## Acceptance Criteria

### Interactive Visual Bounding Boxes
- **Given** an active webpage inspected by CDP
- **When** `cdp_client.py` captures interactive elements (`button`, `input`, `label`, `select`)
- **Then** relative % coordinates (`x`, `y`, `width`, `height`) are calculated relative to the active viewport screenshot
- **And** hidden elements (`width == 0` or `height == 0` or `display: none`) are strictly ignored

### SVG Overlay in SurveyOps.tsx
- **Given** an active session screenshot rendered with bounding box overlays in `SurveyOps.tsx`
- **When** the tutor clicks on an interactive bounding box
- **Then** `override_target` and `override_action` fields are auto-filled in less than 1 second

### Pattern Suggestions
- **Given** survey context and question text
- **When** analyzing topic keywords against `TOPIC_KEYWORDS` (`tobacco`, `income`, `industry_exclusion`)
- **Then** relevant behavior options and rule overrides are suggested to the tutor

### Async Review Queue UI
- **Given** failed sessions logged in the existing `async_review_queue` database table
- **When** the tutor opens the dedicated review panel in `SurveyOps.tsx`
- **Then** the tutor can filter, view, and 1-click triage failed sessions

## Risk / Rollback Plan

| Risk | Mitigation | Rollback Plan |
| --- | --- | --- |
| SVG overlay renders incorrectly or blocks click events | Enforce pointer-events layering and fall back to manual input fields | Toggle feature flag `ENABLE_P2_SVG_OVERLAY=false` to revert to manual input form |
| Bounding box coordinate calculations produce misaligned overlays | Standardize relative percentage normalization against CDP screenshot resolution | Disable relative percentage overlay rendering in `cdp_client.py` |
| Pattern suggestions misclassify topic keywords causing irrelevant overrides | Maintain fallback to default recommendation logic and restrict auto-suggestions to high confidence matches | Disable topic keyword pattern suggestions via configuration flag |
| High load on `async_review_queue` table during batch triage | Implement client-side pagination and indexed DB queries | Fallback to existing CLI-based review triage script |
