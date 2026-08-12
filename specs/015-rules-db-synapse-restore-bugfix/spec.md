# Feature Specification: 015-rules-db-synapse-restore-bugfix

> **Feature:** `015-rules-db-synapse-restore-bugfix`  
> **Status:** Active / Fix Implemented  
> **Target Deliverables:**  
> - Query filter normalization in `rules_api.py` and `persona_graph_memory.py`  
> - Filter cleanup in React UI (`web/src/screens/rules/RulesTable.tsx`)  
> - Restoration of 37 host rules in UI rules table display  

---

## 🎯 1. Overview & Purpose

Feature `015-rules-db-synapse-restore-bugfix` resolves the bug where selecting "Усі Статуси" (or URLs containing `?status=all`, `?host=all`, `?persona=all`, `?source=all`) caused `rules_api.py` and `persona_graph_memory.py` to query `WHERE status IN ('all')`, returning 0 rules (`База Правил (0)`). This fix normalizes filter parameters across backend API and frontend React UI.

---

## 📋 2. Acceptance Criteria (Given / When / Then)

### User Story 1: Filter Normalization & All-Rules Retrieval
As a tutor or operator, I want selecting "Усі Статуси" or passing `status=all` to return all rules from SQLite database `~/.vydra-survey-profiles/survey_graph.db`.

#### Given / When / Then:
- **Given** 37 rules stored in `survey_graph.db`,
- **When** GET `/api/rules?status=all` or `/api/rules?host=all` or `/api/rules` is requested,
- **Then** backend ignores `"all"`, `"undefined"`, `"null"`, and `"*"`, returning all 37 rules.

---

## 🛡️ 3. Verification Requirements

1. **API Integration Test:** `tests/integration/test_rules_filter_restore_bugfix.py` MUST verify `/api/rules?status=all` returns 37 rules.
2. **Build Verification:** `bin/build_web.sh` MUST complete cleanly.
3. **SDD Verification:** `bin/sdd_verify.sh` MUST verify `specs/015-rules-db-synapse-restore-bugfix/spec.md` and exit 0.
