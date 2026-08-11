---
name: speckit-specify
description: Convert feature ideas and user prompts into structured SDD specifications with Given-When-Then scenarios and Acceptance Criteria.
---

# Speckit Specify Skill

This skill transforms raw ideas and feature requests into unambiguous markdown specifications in `specs/<feature_name>/spec.md`.

## Workflow
1. **User Story & Core Intent:** Define *Who*, *What*, and *Why*.
2. **Behavioral Scenarios:** Write Given-When-Then testable scenarios for all key paths.
3. **Acceptance Criteria (AC):** List concrete measurable conditions for feature completion.
4. **Safety & Edge Cases:** Document failure modes, timeouts, and boundary conditions.

## Specification Template (`specs/<feature>/spec.md`)
```markdown
# Specification: <Feature Name>

## 1. User Story & Intent
As a <role>, I want <goal>, so that <benefit>.

## 2. Behavioral Scenarios (Given-When-Then)
### Scenario 1: <Success Case>
- **Given** <initial state>
- **When** <trigger action>
- **Then** <expected outcome>

## 3. Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```
