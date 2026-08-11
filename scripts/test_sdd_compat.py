#!/usr/bin/env python3
"""Validation test verifying SQLite WAL journal mode and SDD backward compatibility."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import persona_graph_memory

def run_compat_test():
    print("=== Running SDD & SQLite WAL Compatibility Test ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_db = os.path.join(tmpdir, "sdd_test_graph.db")
        persona_graph_memory.DB_PATH = test_db
        
        # Connect & verify WAL mode
        conn = persona_graph_memory._connect()
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        busy_timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]
        conn.close()

        print(f"  SQLite Journal Mode: {journal_mode.upper()}")
        print(f"  SQLite Busy Timeout: {busy_timeout}ms")
        
        assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"
        assert busy_timeout == 5000, f"Expected 5000ms busy timeout, got {busy_timeout}"

        # Verify rule applications & async review queue tables exist
        conn = persona_graph_memory._connect()
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        conn.close()

        print(f"  Tables created: {len(tables)} tables verified")
        assert "rule_applications" in tables, "Missing rule_applications table"
        assert "async_review_queue" in tables, "Missing async_review_queue table"

        print("✅ SDD & SQLite WAL Compatibility Test PASSED!")

if __name__ == "__main__":
    run_compat_test()
