# Technical Plan: 008-fallback-browser-sources

> **Feature:** `008-fallback-browser-sources`  
> **Status:** Active  

---

## 🏗️ 1. Architecture Modifications

1. **`persona_graph_memory.py`**:
   - Migration: Add `priority INTEGER NOT NULL DEFAULT 1` to `browser_sources` table if missing.
   - Add default seeds:
     - Seed 1: `swiss_perplexity_comet` (Laptop .30), `kind='direct_cdp'`, `priority=1`, `is_active=1`
     - Seed 2: `dev184_headless_chrome` (`192.168.3.184:9226`), `kind='direct_cdp'`, `priority=2`, `is_active=1`
     - Seed 3: `oracle_vps_placeholder` (`127.0.0.1:9226`), `kind='direct_cdp'`, `priority=3`, `is_active=0`
   - Implement `get_active_browser_sources() -> list[dict]` returning `WHERE is_active=1 ORDER BY priority ASC, id ASC`.
   - Update `set_active_browser_source(id, active: bool, priority: int | None = None)`.

2. **`cdp_client.py`**:
   - Update `CDPClient.__init__()` to query `get_active_browser_sources()`.
   - Implement sequential connection loop across active sources in priority order.
   - Initialize `self.opened_target_ids = set()` tracking every opened tab.
   - Update `open_tab()` and `check_and_attach_new_tab()` to record target IDs into `opened_target_ids`.
   - Update `close()` to close all IDs in `opened_target_ids`.

3. **`settings_api.py` & `astryx_survey_server.py`**:
   - Expose `priority` and multi-source activation endpoints.
   - Add `POST /api/settings/browser-sources/<id>/reorder`.

4. **`web/src/screens/settings/BrowserSourcesPanel.tsx`**:
   - Update UI to show priority badge, Up/Down reordering buttons, and checkbox for fallback chain inclusion.
