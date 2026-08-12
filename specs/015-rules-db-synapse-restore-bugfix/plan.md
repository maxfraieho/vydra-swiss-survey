# Technical Plan: 015-rules-db-synapse-restore-bugfix

> **Feature:** `015-rules-db-synapse-restore-bugfix`  
> **Status:** Active  

---

## 🏗️ 1. Architecture Strategy

1. **`rules_api.py`**:
   - Update `_get_list_param()` to strip and exclude `"all"`, `"undefined"`, `"null"`, `"*"`.
2. **`persona_graph_memory.py`**:
   - Update `list_rules_raw()` `add_filter()` to ignore `"all"`, `"undefined"`, `"null"`, `"*"`.
3. **`RulesTable.tsx`**:
   - Update `updateParam()` to delete parameters with value `""`, `"all"`, `"undefined"`, `"null"`, `"*"`.
