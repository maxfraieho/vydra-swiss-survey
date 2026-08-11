---
name: speckit-plan
description: Technical architecture planning and modular task decomposition (plan.md and tasks.md).
---

# Speckit Plan & Tasks Skill

This skill translates validated specifications into concrete technical execution plans and modular task lists in `specs/<feature>/plan.md` and `specs/<feature>/tasks.md`.

## Workflow
1. **Technical Strategy (`plan.md`):** Outline component changes, database schema updates, API routes, and async workers.
2. **Blast Radius Analysis:** Run dependency checks (`scripts/check_gitnexus_impact.py`) on all target symbols.
3. **Task Decomposition (`tasks.md`):** Break work into independent, testable tasks (T-101, T-102...).
4. **Verification Criteria:** Specify verification commands (`pytest`, latency scripts) for each task.
