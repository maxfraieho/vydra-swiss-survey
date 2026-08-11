---
name: speckit-clarify
description: Autonomous brainstorming interviewer that identifies blind spots, asks targeted clarifying questions, and resolves ambiguities before planning.
---

# Speckit Clarify Skill (Brainstorming & Blind Spot Finder)

This skill acts as an autonomous interviewer during the requirements phase to uncover missing assumptions, ambiguous behavior, and edge cases.

## Clarification Process
1. **Draft Spec Review:** Read `specs/<feature>/spec.md` or user request.
2. **Blind Spot Detection:** Check for:
   - Undefined failure modes or error states.
   - Ambiguous UI/UX behavior or timeouts.
   - Unstated database/API schema dependencies.
3. **Interactive Questionnaire:** Present concise, multiple-choice or direct questions to the operator before generating implementation plans.
4. **Spec Refinement:** Incorporate operator decisions into the spec document.
