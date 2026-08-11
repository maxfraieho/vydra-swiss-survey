# Phase P3: 4-Level Rule Scope Isolation & DOM Skeleton Structure Hash Spec

## Acceptance Criteria

### Seed Provider Migration
- **Given** an uninitialized or migrating database
- **When** applying the database migration script
- **Then** seed rows are initialized for `Qualtrics`, `KeyResponses`, `Meinungsplatz`, `Decipher`, and `Forsta`

### DOM Structural Skeleton Hash (`structure_hash`)
- **Given** an inspected DOM tree
- **When** generating the structural fingerprint `structure_hash`
- **Then** a SHA-256 hash is computed using element tag names, input control types, aria roles, and element hierarchy
- **And** all inner text content of questions and answers is strictly EXCLUDED from hash computation

### 4-Level Scope Resolution
- **Given** a rule lookup request with target context
- **When** resolving active rules for element or page targeting
- **Then** matching priority MUST be evaluated in exact order:
  1. `EXACT_LAYOUT` (`host` + `provider_id` + `structure_hash`)
  2. `PROVIDER_PATTERN` (`provider_id` + `pattern`)
  3. `HOST_PATTERN` (`host` + `pattern`)
  4. `GLOBAL_PATTERN` (`*` + `pattern`)

## Risk / Rollback Plan

| Risk | Mitigation | Rollback Plan |
| --- | --- | --- |
| Provider migration fails or inserts duplicate seed records | Use `INSERT OR IGNORE` / idempotent migration transactions | Run down-migration to purge seeded provider entries |
| Dynamic DOM attributes alter `structure_hash` across identical pages | Filter transient attributes and restrict hash inputs to tag, type, role, hierarchy | Fall back from `EXACT_LAYOUT` level to `PROVIDER_PATTERN` resolution |
| Misconfigured provider pattern overrides global rules unexpectedly | Enforce strict priority ordering in scope resolution queries | Revert rule scope level definitions to global matching default |
