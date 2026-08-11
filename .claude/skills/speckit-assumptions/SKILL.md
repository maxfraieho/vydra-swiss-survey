---
name: speckit-assumptions
description: Addy Osmani's SDD skill for explicitly stating architectural assumptions, non-goals, and boundary contexts before writing code.
---

# Speckit Assumptions Skill (Addy Osmani SDD Pattern)

This skill forces the AI agent to explicitly document implicit assumptions regarding tech stack, databases, hardware boundaries, and non-goals prior to planning.

## 6 Required Context Zones
1. **Objective:** What problem does this change solve?
2. **User Persona & Environment:** Operating environment (e.g. Termux on handset vs Dev server).
3. **Assumptions I'm Making (`ASSUMPTIONS I'M MAKING`):** Explicit list of stack assumptions (SQLite WAL, Hono REST API, async thread pool).
4. **Non-Goals:** What this change will NOT attempt to do.
5. **Edge Cases:** Failure modes (timeouts, offline service, invalid schemas).
6. **Verification Method:** How success will be empirically measured.
