# Feature Specification: 008-fallback-browser-sources

> **Feature:** `008-fallback-browser-sources`  
> **Status:** Active / Implementation Phase  
> **Target Modules:** `persona_graph_memory.py`, `cdp_client.py`, `survey_agent.py`, `rules_api.py`, `settings_api.py`, `web/src/screens/settings/BrowserSourcesPanel.tsx`  

---

## 📌 1. Overview & Tailscale Network Invariant

### Network Invariant (Tailscale Android System VPN)
Termux does not require a standalone `tailscale` CLI binary (`which tailscale` will not find a binary). Tailscale is active at the Android system VPN level via the official Tailscale Android application. Thus, network connectivity to Tailscale IP addresses (e.g. `100.x.y.z` or local hostnames) works transparently for all socket connections across Termux processes.

### Feature Purpose
The `008-fallback-browser-sources` feature introduces an ordered fallback sequence for CDP browser sources (`Laptop .30` $\rightarrow$ `dev-184` $\rightarrow$ `Oracle Cloud VPS`), enabling resilient execution when the primary laptop browser is offline or locked. It also guarantees zero tab leaks via session-scoped `opened_target_ids` tracking and extends the Astryx React UI console with priority controls.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Additive Schema Migration & Priority Querying
As the rules engine and agent, I want `browser_sources` to support a `priority` column and multiple active rows so that sources can be queried in ordered sequence (`priority ASC, id ASC`).

#### Given / When / Then:
- **Given** an existing `browser_sources` SQLite table,
- **When** `init_db()` is executed,
- **Then** `PRAGMA table_info(browser_sources)` verifies `priority INTEGER NOT NULL DEFAULT 1` exists without altering existing data.
- **When** `get_active_browser_sources()` is called,
- **Then** it returns all rows where `is_active=1` ordered by `priority ASC, id ASC`.

### User Story 2: Sequential CDP Connection Fallback
As the CDP client, I want to attempt connecting to active browser sources sequentially in priority order so that if the primary laptop browser is offline, the agent automatically falls back to `dev-184` or subsequent sources without aborting immediately.

#### Given / When / Then:
- **Given** two active browser sources (Priority 1: `Laptop .30`, Priority 2: `dev-184`),
- **When** `CDPClient` initializes and Priority 1 connection times out or fails `ensure_tunnel()`,
- **Then** `CDPClient` logs `⚠️ Primary browser source 'Laptop' offline, falling back to 'dev-184'`, successfully initializes connection using Priority 2, and raises a unified `CDPError` listing all failed attempts ONLY if ALL active sources fail.

### User Story 3: Session-Isolated Multi-Tab Cleanup
As the CDP client and survey agent, I want `opened_target_ids: set[str]` to track every Chrome target tab created or attached during a run, so that `client.close()` in `finally:` blocks closes ALL tabs created during that session.

#### Given / When / Then:
- **Given** a survey run where 3 Chrome tabs were created or switched (`open_tab()`, `check_and_attach_new_tab()`),
- **When** `client.close()` is executed in `finally:` block,
- **Then** `requests.get(f"{base}/json/close/{target_id}")` is invoked for every ID in `opened_target_ids`, leaving zero leaked tabs on shared hosts like `dev-184`.

### User Story 4: Astryx UI Fallback Sequence Controls
As an operator in Astryx UI Console, I want to check multiple browser sources into the fallback sequence and adjust their priority using Up/Down controls.

#### Given / When / Then:
- **Given** the Browser Sources Panel (`BrowserSourcesPanel.tsx`),
- **When** an operator clicks "Up" / "Down" or toggles "In Fallback Chain",
- **Then** the API updates `priority` and `is_active` fields via `POST /api/settings/browser-sources/<id>/reorder`.

---

## 🛡️ 3. Risk & Invariant Safeguards

1. **Backwards Compatibility:** Legacy calls to `get_active_browser_source()` MUST return the top priority active source (`priority ASC LIMIT 1`).
2. **Fail-Loud Preservation:** The agent DOES NOT silently proceed with dummy data. If ALL active sources in the fallback chain fail, it raises a comprehensive `CDPError`.
