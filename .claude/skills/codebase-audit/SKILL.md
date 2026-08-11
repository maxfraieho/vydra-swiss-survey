---
name: codebase-audit
description: Performs a comprehensive codebase audit covering architecture, security, performance, invariants, and test coverage.
---

# Codebase Audit Skill

This skill defines the systematic process for performing architectural, security, and quality audits of the codebase.

## Audit Workflow

### Phase 1: Repository & Structural Mapping
1. **Directory & Module Topology:** Inspect workspace structure, entry points, and module boundaries.
2. **Dependency & Call Graph Analysis:** Trace interactions across core modules (e.g. SQLite WAL, API endpoints, background adapters).

### Phase 2: Security & Invariant Audit
1. **PII & Credentials Safeguards:** Verify that personal data and secrets are never committed or logged in plaintext.
2. **SQL Injection & Input Sanitization:** Check database parameterization (`?` placeholders) and URL/DOM input sanitization.
3. **Execution Safety & Control Flow:** Ensure conditional branches and positional selectors have proper fallbacks.

### Phase 3: Performance & Hot-Path Audit
1. **Hot Path Protection:** Main loops (e.g. `survey_agent.py`, `get_host_rules()`, `bump_rule_outcome()`) MUST stay lightweight, synchronous, and zero-overhead.
2. **Async & Timeout Isolation:** Network calls (Synapse OS, external APIs) MUST execute asynchronously in background thread pools with strict timeouts.

### Phase 4: Testing & Behavioral Quality Audit
1. **Non-Tautological Tests:** Ensure tests verify actual behavioral outcomes (priority cascades, failure handling) rather than trivial presence checks (`assert len > 0`).
2. **Regression Prevention:** Confirm that all identified past bugs have corresponding tests in `tests/regression/`.

### Phase 5: Reporting
1. Produce a severity-ranked audit report:
   - **CRITICAL:** Vulnerabilities or data loss risks.
   - **HIGH:** Performance regressions on hot path or breaking contract changes.
   - **MEDIUM:** Code duplication or missing test coverage.
   - **LOW:** Style & minor documentation cleanup.
2. Always cite exact file path and line numbers for findings.
