# PRODUCT.md — Vydra Swiss Survey Agent Product Vision

> **System:** `vydra-swiss-survey` (Astryx React Console)  
> **Core Purpose:** Autonomous, high-resilience Swiss survey automation agent with HITL tutor feedback, 4-level scope rule engine, multi-browser CDP fallback, and Synapse long-term memory integration.

---

## 🎯 Key User Personas & Workflows

1. **Autonomous Operator:** Launches automated survey sessions via Astryx Web UI console (`/api/survey/status`), monitors active step traces, captcha blockages, and live screenshots.
2. **HITL Tutor:** Reviews failed sessions in `AsyncReviewQueue`, overrides target selectors with percentage bounding boxes, and records shadow rules.
3. **Systems Engineer:** Manages multi-host browser sources (Laptop `.30` -> `dev-184` -> Oracle VPS) and inspects SDD specification compliance (`bin/sdd_verify.sh`).

---

## 🛡️ Non-Negotiable Product Invariants

- **Hot Path Performance:** Main execution loop (`survey_agent.py:L260`) MUST execute in < 5ms.
- **Database Safety:** SQLite DB MUST operate in WAL mode with `busy_timeout=5000ms`.
- **Tutor Precedence:** Human operator overrides have 100% priority over neural predictions.
- **Promotion Gate:** Rules require $N \ge 3$ unique successful runs before auto-promotion to `active`.
