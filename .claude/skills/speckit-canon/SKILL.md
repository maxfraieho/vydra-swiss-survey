---
name: speckit-canon
description: Baseline-driven spec-drift tracking and brownfield codebase specification skill.
---

# Speckit Canon (Baseline-Driven Spec-Drift Tracking)

This skill tracks specification drift in brownfield codebases by comparing live implementation code against declarative specs.

## Workflow
1. **Baseline Extraction:** Inspect existing code signatures, line numbers, and schemas to establish a baseline.
2. **Drift Detection:** Identify discrepancies between existing implementation and proposed specs (`spec-drift`).
3. **Reconciliation:** Either update the spec to accurately reflect established invariants or refactor the code under test coverage.
