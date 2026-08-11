---
name: sdd-workflow
description: Spec-Driven Development (SDD) methodology guide for specify-cli and invariant-based testing.
---

# Spec-Driven Development (SDD) Workflow Skill

This skill defines the methodology for Spec-Driven Development (SDD) using `specify-cli`, project constitution, specification markdown artifacts, and non-tautological behavioral testing.

## Core SDD Principles
1. **Specification as Single Source of Truth:** Specifications in `specs/<feature>/spec.md` define *WHAT* the system should do. Code MUST implement the spec; tests MUST verify behavioral consequences of the spec.
2. **Code First, Spec Second (No Memory Hallucinations):** Always inspect actual code signatures, line numbers, and database schemas before writing specs or tests.
3. **Honest Behavioral Tests (No Tautologies):** Tests must have a real chance to fail. Avoid `assert len(x) > 0` or `assert x == x`. Verify actual side effects, priority cascades, and failure handlings.
4. **Hot-Path Preservation:** Main execution loops (`survey_agent.py`, `get_host_rules()`, `bump_rule_outcome()`) MUST stay lightweight, synchronous, and zero-overhead. Heavy tasks (specs, network calls, audits) run asynchronously outside live execution.
5. **Empirical Verification over Formula Hallucinations:** Use real tool measurements (`check_gitnexus_impact.py`, real HTTP latency benchmarks) rather than arbitrary uncalibrated formulas.

## SDD Artifact Lifecycle
1. `.specify/constitution.md` -> High-level project invariants.
2. `specs/<domain>/spec.md` -> Feature specification (User stories, scenarios, Given-When-Then, invariants).
3. `specs/<domain>/plan.md` -> Technical implementation strategy & risk analysis.
4. `specs/<domain>/tasks.md` -> Modular task breakdown (T-101, T-102...).
5. `tests/unit/`, `tests/integration/`, `tests/regression/` -> Executable test suite verifying the specification.
