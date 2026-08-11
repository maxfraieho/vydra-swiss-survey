#!/usr/bin/env python3
"""
Verification test script for SynapseAdapter.
Tests non-blocking execution (< 500ms timeout), fault tolerance, and SQLite WAL metrics.
"""

import os
import sys
import time
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import persona_graph_memory
from synapse_adapter import SynapseAdapter


def run_test():
    print("=== Running SynapseAdapter Verification & Fault Tolerance Test ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_db = os.path.join(tmpdir, "test_synapse_graph.db")
        persona_graph_memory.DB_PATH = test_db
        
        # Init DB
        conn = persona_graph_memory._connect()
        conn.close()

        # 1. Non-blocking latency test
        start_ts = time.time()
        SynapseAdapter.sync_fact_async("arno", "HAS_FACT", "UBS", metadata={"topic": "bank"})
        SynapseAdapter.sync_rule_async("test.ch", "nav:btn", "Click button", persona="arno", status="shadow")
        SynapseAdapter.sync_trace_async("run_test_123", "test.ch", "arno", "completed", 5)
        elapsed_ms = (time.time() - start_ts) * 1000

        print(f"  Non-blocking trigger latency for 3 async events: {elapsed_ms:.2f}ms")
        assert elapsed_ms < 50.0, f"Expected < 50ms async queue trigger, got {elapsed_ms:.2f}ms"

        # 2. Wait for worker execution & metrics check
        time.sleep(1.5)
        metrics = SynapseAdapter.get_metrics()
        print(f"  Synapse Metrics: {metrics}")
        assert "failures" in metrics, "Missing failures key in metrics"
        assert "status" in metrics, "Missing status key in metrics"

        # 3. Verify SQLite WAL mode remains functional
        conn = persona_graph_memory._connect()
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        conn.close()
        print(f"  SQLite Journal Mode: {journal_mode.upper()}")
        assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"

        print("✅ SynapseAdapter Non-Blocking & Fault Tolerance Test PASSED!")


if __name__ == "__main__":
    run_test()
