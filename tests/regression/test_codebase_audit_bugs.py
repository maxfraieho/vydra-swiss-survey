#!/usr/bin/env python3
"""
tests/regression/test_codebase_audit_bugs.py
Regression tests for 3 verified codebase audit bugs:
1. Dual-promotion bug (shadow rule MUST NOT be promoted to active on 1 win).
2. SQL injection attempt in active_run_id parameter of get_host_rules().
3. UNKNOWN outcome MUST NOT alter wins/losses or pollute rule_applications.
"""
import os
import sys
import tempfile
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import persona_graph_memory


def test_regression_dual_promotion_prevention():
    """
    Bug 1 Regression Test:
    Verify that calling bump_rule_outcome() with a single completed outcome
    DOES NOT promote a shadow rule to active. Rule MUST remain shadow until
    auto_promote_rules(min_unique_runs=3) confirms N >= 3 distinct run_ids.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        persona_graph_memory.DB_PATH = os.path.join(tmpdir, "reg_test1.db")
        conn = persona_graph_memory._connect()
        conn.close()

        rule_id = persona_graph_memory.record_host_rule(
            host="test.ch", pattern="tobacco", behavior="Test behavior",
            persona="arno", source="human_override", status="shadow", confidence=0.9
        )

        def get_status_and_wins():
            c = persona_graph_memory._connect()
            r = c.execute("SELECT status, wins, losses FROM host_rules WHERE id=?", (rule_id,)).fetchone()
            c.close()
            return r[0], r[1], r[2]

        # Single win MUST NOT promote to active
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_1")
        status, wins, losses = get_status_and_wins()
        assert status == "shadow", f"Regression! Shadow rule promoted after 1 win: status={status}"
        assert wins == 1

        # Duplicate run_1 win MUST NOT promote
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_1")
        status, wins, losses = get_status_and_wins()
        assert status == "shadow"
        assert wins == 2

        # Second distinct run_2 win MUST NOT promote
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_2")
        status, wins, losses = get_status_and_wins()
        assert status == "shadow"
        assert wins == 3

        # Third distinct run_3 win MUST trigger promotion to active
        persona_graph_memory.bump_rule_outcome([rule_id], "completed", run_id="run_3")
        status, wins, losses = get_status_and_wins()
        assert status == "active", f"Failed to promote rule after 3 distinct run_ids: status={status}"


def test_regression_sql_injection_in_get_host_rules():
    """
    Bug 2 Regression Test:
    Verify that passing malicious active_run_id payload into get_host_rules()
    is 100% parameterized via '?' placeholders and does NOT cause SQL injection,
    syntax errors, or unexpected row leaks.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        persona_graph_memory.DB_PATH = os.path.join(tmpdir, "reg_test2.db")
        conn = persona_graph_memory._connect()
        conn.close()

        # Create 1 active rule and 1 shadow rule
        r_active = persona_graph_memory.record_host_rule(
            host="test.ch", pattern="p1", behavior="Active rule",
            persona="arno", source="seed", status="active"
        )
        r_shadow = persona_graph_memory.record_host_rule(
            host="test.ch", pattern="p2", behavior="Shadow rule",
            persona="arno", source="human_override", status="shadow",
            evidence={"run_id": "legit_run_99"}
        )

        # 1. Normal query without active_run_id -> returns only active rule (p1)
        rules = persona_graph_memory.get_host_rules(host="test.ch", persona="arno", include_shadow=False)
        patterns = [r['pattern'] for r in rules]
        assert "p1" in patterns
        assert "p2" not in patterns

        # 2. Query with SQL injection payload in active_run_id
        sql_injection_payload = "' OR '1'='1' UNION SELECT * FROM host_rules WHERE '1'='1"
        try:
            rules_injected = persona_graph_memory.get_host_rules(
                host="test.ch", persona="arno", include_shadow=False, active_run_id=sql_injection_payload
            )
            patterns_injected = [r['pattern'] for r in rules_injected]
            # Must NOT leak shadow rule p2 because the payload is treated strictly as literal string!
            assert "p2" not in patterns_injected, "SQL injection leaked shadow rule!"
            assert "p1" in patterns_injected
        except sqlite3.OperationalError as err:
            pytest.fail(f"SQL injection payload caused SQLite syntax error: {err}")


def test_regression_unknown_outcome_handling():
    """
    Bug 3 Regression Test:
    Verify that UNKNOWN outcome ignores the run, does NOT increment wins or losses,
    and does NOT insert into rule_applications.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        persona_graph_memory.DB_PATH = os.path.join(tmpdir, "reg_test3.db")
        conn = persona_graph_memory._connect()
        conn.close()

        rule_id = persona_graph_memory.record_host_rule(
            host="test.ch", pattern="p1", behavior="Behavior",
            persona="arno", source="seed", status="shadow"
        )

        # Call bump_rule_outcome with "UNKNOWN"
        persona_graph_memory.bump_rule_outcome([rule_id], "UNKNOWN", run_id="run_unknown_1")
        persona_graph_memory.bump_rule_outcome([rule_id], "unknown", run_id="run_unknown_2")

        c = persona_graph_memory._connect()
        row = c.execute("SELECT wins, losses FROM host_rules WHERE id=?", (rule_id,)).fetchone()
        apps_count = c.execute("SELECT COUNT(*) FROM rule_applications WHERE rule_id=?", (rule_id,)).fetchone()[0]
        c.close()

        assert row[0] == 0, f"UNKNOWN outcome incremented wins: {row[0]}"
        assert row[1] == 0, f"UNKNOWN outcome incremented losses: {row[1]}"
        assert apps_count == 0, f"UNKNOWN outcome created rule_applications entry: {apps_count}"
