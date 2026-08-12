# PRODUCT.md — Vydra Swiss Survey Agent Product Record

> **System:** `vydra-swiss-survey` (Astryx React Console)  
> **Schema:** 3.5.0  

## Positioning

Vydra Swiss Survey Agent is an autonomous, high-resilience Swiss survey automation console designed for operator monitoring, Human-in-the-Loop (HITL) tutor feedback, 4-level scope rule engine, multi-browser CDP fallback, and Synapse long-term memory integration.

## Operating Context

- **Environment:** Android Termux (Python 3.14 + SQLite WAL) connected to local CDP browser sources (`.30`, `dev-184`, Oracle VPS).
- **Target Audience:** Autonomous operators monitoring live sessions and HITL tutors managing failed survey triage and shadow rule promotions.

## Evidence on Hand

- **Rule Engine Benchmarks:** 4-level scope resolution (`EXACT_LAYOUT`, `PROVIDER_PATTERN`, `HOST_PATTERN`, `GLOBAL_PATTERN`) tested with 48 passing integration test cases.
- **Performance Invariant:** Main execution loop completes in < 5ms.
- **Promotion Gate:** Rules require N >= 3 unique successful runs before auto-promotion to active status.

## Product Principles

1. **Zero Slop UI:** Standardized `@astryxdesign/core` components only. No raw HTML containers with unstyled inline colors.
2. **Tutor Precedence:** Human operator overrides hold 100% precedence over neural vision predictions.
3. **Mobile First Touch Targets:** Interactive controls MUST maintain a minimum touch target area of 44px.
