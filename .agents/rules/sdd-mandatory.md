# SDD Mandatory Enforcement Rule

**Priority:** Mandatory / High Enforcement  
**Applies To:** All Agent sessions in `vydra-swiss-survey`

## Mandatory SDD Rules

1. **Spec First, Code Second:** For EVERY new feature request, UI enhancement, API endpoint addition, or architectural refactoring, the agent MUST execute SDD Phase 1 BEFORE writing or modifying implementation code files:
   - Create `specs/<feature_name>/spec.md` (User stories, core requirements, JSON schemas).
   - Create `specs/<feature_name>/plan.md` (Architecture boundaries & flow diagrams).
   - Create `specs/<feature_name>/tasks.md` (Task breakdown checklist).

2. **Skill Activation:** The agent MUST invoke `view_file` on `.agents/skills/sdd-workflow/SKILL.md` (or `speckit-specify`) whenever commencing a feature development task.

3. **Behavioral Test Verification:** Every SDD feature MUST include a non-tautological test in `tests/` verifying the requirements specified in `spec.md`.

4. **Zero Code Without Spec:** The agent is strictly prohibited from executing `replace_file_content` or `write_to_file` on implementation files for a new feature until the corresponding `specs/<feature_name>/spec.md` file exists.
