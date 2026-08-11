---
name: speckit-constitution
description: Formulate, enforce, and audit non-negotiable project invariants, safety boundaries, and stack constraints.
---

# Speckit Constitution Skill

This skill defines the workflow for establishing and enforcing project-level invariants in `.specify/constitution.md`.

## Core Guidelines
1. **Identify Non-Negotiables:** Define hard constraints regarding data privacy (PII isolation), execution latency (hot path boundaries), security, and state persistence.
2. **Enforce Structural Invariants:** Ensure all feature specs (`specs/<feature>/spec.md`) and code changes explicitly comply with the constitution.
3. **Audit Against Regressions:** Any modification that violates a constitutional invariant MUST be rejected or require explicit confirmation.

## Constitution Format
```markdown
# Project Constitution

## Invariants
1. **Data Isolation & PII Protection:** Credentials and user secrets MUST NEVER be logged or stored in plaintext.
2. **Hot Path Performance:** Critical execution loops MUST remain synchronous, lightweight, and zero-overhead.
3. **Verification Gate:** Automated state changes (e.g. promotions) require empirical verification (N >= 3 unique runs).
```
