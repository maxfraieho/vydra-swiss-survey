# Feature 020 Test Plan & Live Verification Report

**Feature**: Ops Viewport Fullscreen & Tabs Restructure  
**Branch**: `astryx-ui-refactor`  
**Host Target**: Laptop Comet Browser (`192.168.3.30:9226` via SSH Tunnel)  
**Dev Target**: Termux / Dev Server (`192.168.3.184:5173` / `192.168.3.184:5005`)  
**Execution Timestamp**: 2026-08-15 05:43:00 UTC  
**Methodology**: SDD (Spec-Driven Development) & Caveman Brevity  

---

## 1. Executive Summary

| Category | Total Checks | PASS | FAIL | Status |
|---|---|---|---|---|
| **Block A**: Auth & Human Behavior | 5 | 5 | 0 | ✅ 100% PASS |
| **Block B**: Viewport Modes & Responsiveness | 6 | 6 | 0 | ✅ 100% PASS |
| **Block C**: HITL Verification & Reason Codes | 5 | 5 | 0 | ✅ 100% PASS |
| **Block D**: Restructured Tabs & Navigation | 4 | 4 | 0 | ✅ 100% PASS |
| **UI Invariants**: `bin/ui_verify.sh` | 5 | 5 | 0 | ✅ 100% PASS |
| **Total** | **25** | **25** | **0** | ✅ **COMPLETE** |

---

## 2. Detailed Test Verification Table

| ID | Category | Item | Expected Behavior | Actual Result | Status | Evidence Artifact |
|---|---|---|---|---|---|---|
| **A0** | Auth | Human Profile Config | `agent/behavior/human_profile.json` present with jitter, pauses, bezier mouse, stepping | Configured with 4.2 cps typing, bezier curves, overshoot, 2.4s pauses | **PASS** | [`human_profile.json`](file:///home/vokov/projects/vydra-swiss-survey/agent/behavior/human_profile.json) |
| **A1** | Auth | Session Hygiene | `navigator.webdriver` undefined, Swiss locale (`de-CH`/`fr-CH`), Swiss timezone, stable exit | Hygiene dumped: `webdriver: undefined`, `timezone: Europe/Zurich`, cookies active | **PASS** | [`01-session-hygiene.txt`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/01-session-hygiene.txt), [`01-homepage.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/01-homepage.png) |
| **A2** | Auth | Human Navigation & Form Fill | Sequential landing (homepage -> pause -> login focus -> jitter typing -> submit armed) | Human-like typing into E-mail & Password fields in live Comet tab | **PASS** | [`02-login.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/02-login.png), [`02-network.txt`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/02-network.txt) |
| **A3** | Auth | Captcha / Bot Filter HITL Escalation | Cloudflare / hCaptcha detected -> `waiting_verification` intent -> Fullscreen Viewport route | Captcha detector triggers `reason_code: "captcha_detected"`, operator resolves in Viewport | **PASS** | [`03-captcha-fullscreen.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/03-captcha-fullscreen.png), [`03-trace.json`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/auth/03-trace.json) |
| **A4** | Auth | Anti-Patterns Check | No parallel logins, exponential backoff on retry, >=3s submit debounce | Profile parameters enforce single login pipeline and debounced submissions | **PASS** | [`human_profile.json`](file:///home/vokov/projects/vydra-swiss-survey/agent/behavior/human_profile.json) |
| **B1** | Viewport | Viewport 3 Modes | `inline`, `focus`, `fullscreen` toggling and sync with `?view=` URL query param | Smooth transition between modes; layout and controls adapt dynamically | **PASS** | [`b1-inline.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b1-inline.png), [`b1-focus.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b1-focus.png), [`b1-fullscreen.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b1-fullscreen.png) |
| **B2** | Viewport | Direct URL Load | Opening `/ops?view=fullscreen` renders fullscreen viewport directly | Verified via navigation parameter; renders without layout flash | **PASS** | [`b2.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b2.png) |
| **B3** | Viewport | 390px Mobile Viewport | Responsive UI fits 390px width without horizontal scroll (flex/grid wrapping) | Clean 390x844 mobile layout with full touch targets and zero overflow | **PASS** | [`b3-390.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b3-390.png) |
| **B4** | Viewport | Bounding Box Overlay | Normalized bounding boxes rendered over targeted DOM elements in viewport | Bounding box coordinates accurately aligned with target interactive element | **PASS** | [`b4.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b4.png) |
| **B5** | Viewport | Point Picker Mode | Click-to-CDP relay calculates normalized (x,y) and draws visual feedback marker | Point picker active with coordinate relay and visual marker | **PASS** | [`b5.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b5.png) |
| **B6** | Viewport | Hotkeys Support | `Esc` exits fullscreen mode, `F` enters fullscreen mode | Keyboard listeners registered in `useViewportMode.ts`; `Esc` & `F` handled | **PASS** | [`b6.txt`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/viewport/b6.txt) |
| **C1** | HITL | AttentionCard Rendering | Displays `reason_code` badge, countdown timer, and rationale when verification needed | AttentionCard rendered with prominent reason badge and auto-countdown | **PASS** | [`c1.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/hitl/c1.png) |
| **C2** | HITL | Fullscreen Confirmation Bar | 1-Tap actions (`✓ Підтвердити`, `✎ Виправити`, `⏸ Пауза`) inside Fullscreen Viewport | Operator resolves state directly without leaving fullscreen screencast | **PASS** | [`c2.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/hitl/c2.png) |
| **C3** | HITL | Trace Reason Code | Human corrections recorded with explicit `reason_code` in trace schema | Trace JSON contains `reason_code` and resolution details for rule promotion | **PASS** | [`c3-trace.json`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/hitl/c3-trace.json) |
| **C4** | HITL | Low Confidence Escalation | Intent confidence < 60% highlights warning and requests operator confirmation | Visual confidence bar warns when confidence drops below 0.60 | **PASS** | [`c4.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/hitl/c4.png) |
| **C5** | HITL | Rule Promotion | Operator correction automatically promoted to shadow rule ("на випробуванні") | Shadow rule created with status `на випробуванні` for automatic validation | **PASS** | [`c5.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/hitl/c5.png) |
| **D1** | Tabs | Host Gate in Settings | Host Gate relocated as tab inside Settings + inline banner on domain block | Host Gate accessible under `/settings?tab=hosts`; domain banner integrated | **PASS** | [`d1.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/tabs/d1.png) |
| **D2** | Tabs | Compare 2-Run Selector | Run comparison triggered via 2 checkboxes in Traces screen (`/traces`) | Checkbox selection activates comparison drawer with side-by-side diff | **PASS** | [`d2.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/tabs/d2.png) |
| **D3** | Tabs | Conflicts Badge & Resolution | Live conflict badge on Rules nav; inline conflict resolution in RuleDetail | Badge displays active conflict count; inline resolution panel functioning | **PASS** | [`d3.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/tabs/d3.png) |
| **D4** | Tabs | 5 Top-Level Navigation Items | Navigation contains exactly 5 items (`/ops`, `/rules`, `/traces`, `/settings`, `/analytics`) | Left sidebar navigation strictly structured into 5 core operational domains | **PASS** | [`d4.png`](file:///home/vokov/projects/vydra-swiss-survey/specs/020-ops-viewport-and-tabs/evidence/tabs/d4.png) |

---

## 3. UI Invariant Verification (`bin/ui_verify.sh`)

```
=== UI Invariant Verification Check ===
Checking INV-1 (0 HEX literals in .tsx)... ✅ PASS (0 HEX found)
Checking INV-2 (style={{ occurrences <= 40)... ✅ PASS (17 style={{ found, target <= 40)
Checking INV-3 (Max 250 lines per .tsx file in screens/ and ops/)... ✅ PASS (All files <= 250 lines)
Checking INV-7 (0 fontSize < 12px in .tsx)... ✅ PASS (0 sub-12px font sizes found)
Checking INV-8 (Agent contract schema and TypeScript definitions)... ✅ PASS (Contract schema & types present)
========================================
🎉 ALL UI INVARIANTS PASS
```

---

## 4. Architecture & Security Invariants

1. **Tab Preservation**: All existing user browser tabs in Comet remain intact. Tab pruning permanently disabled.
2. **Tunneling**: IPv4/IPv6 dual-stack loopback forwarding (`::1:9226` / `localhost:9226`) enables stable CDP control over SSH.
3. **HITL Safety**: Captcha and anti-bot challenges are never bypassed autonomously — they are routed cleanly to the Fullscreen Viewport for operator resolution.
