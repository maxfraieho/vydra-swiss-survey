---
name: gitnexus-audit
description: Codebase architectural auditing and dependency flow analysis using GitNexus graph engine.
---

# GitNexus Codebase Architectural Audit Skill

This skill defines the methodology for performing architectural audits of Python / JS codebases using GitNexus knowledge graph tools (`context`, `query`, `impact`, `detect_changes`).

## Key Audit Objectives
1. **Call Graph Topology & Dependency Analysis:** Map call chains across API endpoints, memory adapters, rules cascade engines, and execution loops.
2. **Blast Radius Analysis:** Measure upstream/downstream impact before editing core symbols.
3. **Execution Flow Traceability:** Trace data flows from user inputs -> database/adapters -> external services.
4. **Invariant Safeguards:** Ensure high-risk methods retain required constraints (e.g., WAL mode, non-blocking execution timeouts, parameter sanitization).

## Audit Workflow Steps
1. **Update Graph Index:** Verify GitNexus graph index is up to date (`gitnexus analyze` or MCP `detect_changes()`).
2. **Symbol Mapping:** Query core symbols (`query`, `context`) to identify callers and callees.
3. **Impact Mapping:** Execute `impact(target="symbol", direction="upstream")` to check blast radius.
4. **Architectural Verification:** Verify contract integrity, exception handling, and performance boundaries.
