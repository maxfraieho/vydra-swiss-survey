#!/usr/bin/env python3
"""
synapse_adapter.py — Non-blocking, fault-tolerant async adapter for Synapse Memory OS.
Guarantees <= 500ms execution timeout and zero disruption to survey execution or SQLite WAL DB.
"""

import os
import sys
import json
import logging
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional

logger = logging.getLogger("synapse_adapter")

# System paths & parameters
SYNAPSE_SERVER_JS = os.path.expanduser("~/synapse/apps/mcp-server/dist/index.js")
SYNAPSE_TIMEOUT_SEC = 0.5  # Strict <= 500ms threshold
MAX_WORKERS = 2

# Thread pool for non-blocking execution
_executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="synapse_worker")


def _record_sync_metric(success: bool) -> None:
    """Record sync timestamp and failure metric into SQLite persona_graph_memory safely."""
    try:
        import persona_graph_memory
        conn = persona_graph_memory._connect()
        now_str = persona_graph_memory._now()
        
        # Ensure app_settings exists
        conn.execute("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)")
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('synapse_last_sync_ts', ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (now_str, now_str)
        )
        if not success:
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES ('synapse_sync_failures', '1', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at=excluded.updated_at",
                (now_str,)
            )
        conn.commit()
        conn.close()
    except Exception as err:
        logger.warning(f"[SynapseAdapter] Metric logging error (ignored): {err}")


def _invoke_synapse_payload(payload: Dict[str, Any]) -> bool:
    """Internal helper to execute Synapse command with strict 500ms timeout."""
    start_ts = time.time()
    try:
        if not os.path.exists(SYNAPSE_SERVER_JS):
            logger.debug("[SynapseAdapter] Synapse server dist/index.js not found.")
            _record_sync_metric(success=False)
            return False

        # Build execution string
        cmd = ["node", SYNAPSE_SERVER_JS]
        input_data = json.dumps(payload)
        
        proc = subprocess.run(
            cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=SYNAPSE_TIMEOUT_SEC
        )
        
        elapsed_ms = (time.time() - start_ts) * 1000
        if proc.returncode == 0:
            logger.debug(f"[SynapseAdapter] Sync successful in {elapsed_ms:.1f}ms")
            _record_sync_metric(success=True)
            return True
        else:
            logger.warning(f"[SynapseAdapter] Synapse process exited {proc.returncode} in {elapsed_ms:.1f}ms: {proc.stderr[:200]}")
            _record_sync_metric(success=False)
            return False

    except subprocess.TimeoutExpired:
        elapsed_ms = (time.time() - start_ts) * 1000
        logger.warning(f"[SynapseAdapter] Timeout ({elapsed_ms:.1f}ms > 500ms). Skipping Synapse sync.")
        _record_sync_metric(success=False)
        return False
    except Exception as err:
        logger.warning(f"[SynapseAdapter] Exception during sync: {err}")
        _record_sync_metric(success=False)
        return False


class SynapseAdapter:
    """Public non-blocking API for Synapse integration."""

    @staticmethod
    def sync_fact_async(subject: str, predicate: str, object_val: str, persona: str = "*", metadata: Optional[Dict[str, Any]] = None) -> None:
        """Asynchronously mirror fact into Synapse."""
        payload = {
            "type": "fact",
            "subject": subject,
            "predicate": predicate,
            "object": object_val,
            "persona": persona,
            "metadata": metadata or {}
        }
        _executor.submit(_invoke_synapse_payload, payload)

    @staticmethod
    def sync_rule_async(host: str, pattern: str, behavior: str, persona: str = "*", status: str = "shadow") -> None:
        """Asynchronously mirror rule into Synapse."""
        payload = {
            "type": "rule",
            "host": host,
            "pattern": pattern,
            "behavior": behavior,
            "persona": persona,
            "status": status
        }
        _executor.submit(_invoke_synapse_payload, payload)

    @staticmethod
    def sync_trace_async(run_id: str, host: str, persona: str, outcome: str, step_count: int = 0) -> None:
        """Asynchronously mirror run trace into Synapse."""
        payload = {
            "type": "trace",
            "run_id": run_id,
            "host": host,
            "persona": persona,
            "outcome": outcome,
            "step_count": step_count
        }
        _executor.submit(_invoke_synapse_payload, payload)

    @staticmethod
    def get_metrics() -> Dict[str, Any]:
        """Fetch current sync metrics from SQLite app_settings."""
        try:
            import persona_graph_memory
            conn = persona_graph_memory._connect()
            rows = conn.execute("SELECT key, value FROM app_settings WHERE key LIKE 'synapse_%'").fetchall()
            conn.close()
            metrics = {r[0]: r[1] for r in rows}
            return {
                "last_sync_ts": metrics.get("synapse_last_sync_ts", None),
                "failures": int(metrics.get("synapse_sync_failures", 0)),
                "status": "online" if os.path.exists(SYNAPSE_SERVER_JS) else "offline"
            }
        except Exception:
            return {"status": "error", "failures": 0, "last_sync_ts": None}
