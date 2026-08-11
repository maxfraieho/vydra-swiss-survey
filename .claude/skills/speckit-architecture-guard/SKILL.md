---
name: speckit-architecture-guard
description: Security and architecture review extension for Spec Kit during feature planning.
---

# Speckit Architecture Guard & Security Review Skill

This skill performs automated architectural and security checks on proposed specifications during the `/speckit.plan` phase.

## Review Checkpoints
1. **Security Vulnerabilities:** Scan for OWASP Top 10 patterns (unparameterized SQL, unauthenticated endpoints, plain text secrets).
2. **Hot Path Violations:** Detect any attempt to inject heavy network, file IO, or subprocess calls into live execution loops.
3. **Database Concurrency:** Ensure all SQLite connections enforce `PRAGMA journal_mode=WAL` and `busy_timeout=5000`.
4. **Contract Drift:** Prevent uncoordinated method signature modifications that break calling modules.
