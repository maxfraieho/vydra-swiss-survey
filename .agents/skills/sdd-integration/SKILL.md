---
name: sdd-integration
description: Guide and execute the SDD Integration / External Service Adapter workflow (Template 4) for vydra-swiss-survey — hot-path isolation, hard timeouts, fault tolerance.
---

# SDD Integration Skill

When activated for an integration/adapter task:

1. Read `docs/for-agents/sdd-development-methodology.md`, section "ШАБЛОН 4" (Integration / Adapter), and follow it literally.
2. The external service MUST run outside the hot path (async via `ThreadPoolExecutor`).
3. Set a hard timeout based on real p95 measurements (e.g. 150ms HTTP, 1000ms subprocess).
4. On failure (connection refused / timeout), fail in < 2ms, increment `app_settings.failures`, and let the main survey loop continue without delay.
5. Read the real service contract (Swagger/OpenAPI/JSON-RPC) before writing the adapter — do not invent the API from memory.
6. Implement the adapter in its own module (`<service>_adapter.py`), add metrics recording to `app_settings`.
7. Create `scripts/verify_<service>_roundtrip.py` (write → read back → compare) and `tests/regression/test_<service>_protocol.py`.
8. Final report must state: adapter file, round-trip verification result, regression-test result, and whether `bash bin/sdd_verify.sh` passed.
