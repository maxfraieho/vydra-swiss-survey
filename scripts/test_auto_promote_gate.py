#!/usr/bin/env python3
"""Verification test script for shadow->active promotion N>=3 unique run_id gate."""
import os
import sys
import tempfile
import sqlite3

# Ensure local import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import persona_graph_memory

def run_test():
    # Use temporary DB for test isolation
    with tempfile.TemporaryDirectory() as tmpdir:
        test_db = os.path.join(tmpdir, "test_graph.db")
        persona_graph_memory.DB_PATH = test_db
        
        # Initialize DB
        conn = persona_graph_memory._connect()
        conn.close()

        # 1. Create a shadow rule
        host = "test-survey-host.ch"
        pattern = "nav:test_pattern"
        rule_id = persona_graph_memory.record_host_rule(
            host=host,
            pattern=pattern,
            behavior="Test behavior click button",
            persona="arno",
            source="human_override",
            status="shadow",
            confidence=0.9,
            evidence={"test": True}
        )

        def get_status_and_wins():
            c = persona_graph_memory._connect()
            r = c.execute("SELECT status, wins, losses FROM host_rules WHERE id=?", (rule_id,)).fetchone()
            c.close()
            return r[0], r[1], r[2]

        def get_unique_runs_count():
            c = persona_graph_memory._connect()
            r = c.execute("SELECT COUNT(DISTINCT run_id) FROM rule_applications WHERE rule_id=? AND LOWER(outcome)='completed'", (rule_id,)).fetchone()
            c.close()
            return r[0]

        status, wins, losses = get_status_and_wins()
        print(f"Step 0 (Initial): status={status}, wins={wins}, unique_runs={get_unique_runs_count()}")
        assert status == "shadow", f"Expected shadow, got {status}"

        # 2. First completed run (run_1) -> should stay 'shadow'
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_1")
        status, wins, losses = get_status_and_wins()
        print(f"Step 1 (After run_1): status={status}, wins={wins}, unique_runs={get_unique_runs_count()}")
        assert status == "shadow", f"ERROR: Rule promoted early after 1 run! status={status}"

        # 3. Duplicate completed run in SAME run_id (run_1 second hit) -> should stay 'shadow'
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_1")
        status, wins, losses = get_status_and_wins()
        print(f"Step 2 (After duplicate run_1): status={status}, wins={wins}, unique_runs={get_unique_runs_count()}")
        assert status == "shadow", f"ERROR: Rule promoted early on duplicate run_1! status={status}"

        # 4. Second distinct completed run (run_2) -> should stay 'shadow'
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_2")
        status, wins, losses = get_status_and_wins()
        print(f"Step 3 (After run_2): status={status}, wins={wins}, unique_runs={get_unique_runs_count()}")
        assert status == "shadow", f"ERROR: Rule promoted early after 2 runs! status={status}"

        # 5. Third distinct completed run (run_3) -> MUST now be promoted to 'active'!
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_3")
        status, wins, losses = get_status_and_wins()
        print(f"Step 4 (After run_3): status={status}, wins={wins}, unique_runs={get_unique_runs_count()}")
        assert status == "active", f"ERROR: Rule failed to promote after 3 unique runs! status={status}"

        print("\n✅ ALL TESTS PASSED SUCCESSFULLY! N>=3 unique run_id promotion gate is verified.")

if __name__ == "__main__":
    run_test()
