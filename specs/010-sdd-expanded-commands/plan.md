# Technical Plan: 010-sdd-expanded-commands

> **Feature:** `010-sdd-expanded-commands`  
> **Status:** Active  

---

## 🏗️ 1. Deliverables Architecture

1. **`.claude/commands/sdd/` Commands**:
   - `clarify.md` — `/sdd:clarify` (Points to Template 7)
   - `audit.md` — `/sdd:audit` (Points to Template 8)
   - `verify.md` — `/sdd:verify` (Points to Template 9)

2. **`docs/for-agents/sdd-development-methodology.md`**:
   - Add **"### 💡 ШАБЛОН 7: Зняття Неоднозначностей та Брейнштормінг (Pre-Specification Clarification)"**.
   - Add **"### 🔍 ШАБЛОН 8: Глибокий Аудит Відхилення Коду та Spec-Drift (Specification Audit)"**.
   - Add **"### 🛡️ ШАБЛОН 9: Комплексна Верифікація Специфікацій та Системи (System Verification)"**.

3. **`tests/integration/test_sdd_expanded_commands.py`**:
   - Tests existence, YAML frontmatter, and methodology path links for all 3 new slash commands.
   - Tests presence of Templates 7, 8, 9 in `docs/for-agents/sdd-development-methodology.md`.

4. **`bin/sdd_verify.sh`**:
   - Includes `specs/010-sdd-expanded-commands/spec.md`, `clarify.md`, `audit.md`, `verify.md`.
