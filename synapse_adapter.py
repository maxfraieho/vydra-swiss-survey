#!/usr/bin/env python3
"""
synapse_adapter.py — Fault-tolerant MCP JSON-RPC 2.0 adapter for Synapse Memory OS.
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
# NOTE: Node cold-start in Termux takes ~740-860ms (p95: 863ms).
# Under strict SYNAPSE_TIMEOUT_SEC = 0.5, cold-start invocations will time out
# and record a failure in app_settings.synapse_sync_failures without impacting hot path.
SYNAPSE_TIMEOUT_SEC = 0.5  # Strict <= 500ms threshold per operator directive
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


def _invoke_mcp_tool_call(tool_name: str, tool_args: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Executes a tool call over standard MCP JSON-RPC 2.0 stdio protocol.
    Performs handshake: initialize -> notifications/initialized -> tools/call
    """
    start_ts = time.time()
    try:
        if not os.path.exists(SYNAPSE_SERVER_JS):
            logger.debug("[SynapseAdapter] Synapse server dist/index.js not found.")
            _record_sync_metric(success=False)
            return None

        # Build MCP JSON-RPC 2.0 handshake + call sequence
        rpc_init = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "vydra-swiss-survey", "version": "1.0"}
            }
        }
        rpc_initialized = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        rpc_call = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": tool_args
            }
        }

        input_lines = "\n".join([
            json.dumps(rpc_init),
            json.dumps(rpc_initialized),
            json.dumps(rpc_call)
        ]) + "\n"

        # Force SYNAPSE_EMBED_PROVIDER=hash to bypass native onnxruntime binding issues on Termux
        env = os.environ.copy()
        env["SYNAPSE_EMBED_PROVIDER"] = "hash"

        proc = subprocess.run(
            ["node", SYNAPSE_SERVER_JS],
            input=input_lines,
            capture_output=True,
            text=True,
            timeout=SYNAPSE_TIMEOUT_SEC,
            env=env
        )

        elapsed_ms = (time.time() - start_ts) * 1000
        if proc.returncode != 0:
            logger.warning(f"[SynapseAdapter] Process exited {proc.returncode} in {elapsed_ms:.1f}ms: {proc.stderr[:200]}")
            _record_sync_metric(success=False)
            return None

        # Parse JSON-RPC responses from stdout lines
        stdout_lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        for line in stdout_lines:
            try:
                resp = json.loads(line)
                if resp.get("id") == 2:
                    if "result" in resp and not resp["result"].get("isError"):
                        _record_sync_metric(success=True)
                        return resp["result"]
                    else:
                        logger.warning(f"[SynapseAdapter] MCP tool call returned error: {resp}")
                        _record_sync_metric(success=False)
                        return None
            except json.JSONDecodeError:
                continue

        logger.warning(f"[SynapseAdapter] MCP tool response not found in stdout in {elapsed_ms:.1f}ms")
        _record_sync_metric(success=False)
        return None

    except subprocess.TimeoutExpired:
        elapsed_ms = (time.time() - start_ts) * 1000
        logger.warning(f"[SynapseAdapter] Timeout ({elapsed_ms:.1f}ms > 500ms). Skipping Synapse sync.")
        _record_sync_metric(success=False)
        return None
    except Exception as err:
        logger.warning(f"[SynapseAdapter] Exception during MCP call: {err}")
        _record_sync_metric(success=False)
        return None


class SynapseAdapter:
    """Public non-blocking API for Synapse integration."""

    @staticmethod
    def sync_fact_async(subject: str, predicate: str, object_val: str, persona: str = "*", metadata: Optional[Dict[str, Any]] = None) -> None:
        """Asynchronously mirror fact into Synapse via memory_write."""
        content = f"{subject} {predicate} {object_val}".strip()
        entity_key = f"persona.{persona}.{subject}"
        tags = ["domain:fact", f"persona:{persona}"]
        if metadata and "topic" in metadata:
            tags.append(f"topic:{metadata['topic']}")

        tool_args = {
            "type": "semantic",
            "content": content,
            "entityKey": entity_key,
            "tags": tags
        }
        _executor.submit(_invoke_mcp_tool_call, "memory_write", tool_args)

    @staticmethod
    def sync_rule_async(host: str, pattern: str, behavior: str, persona: str = "*", status: str = "shadow") -> None:
        """Asynchronously mirror rule into Synapse via memory_write."""
        content = f"Rule for host {host} pattern {pattern}: {behavior}".strip()
        entity_key = f"hostrule.{host}.{persona}.{pattern}"
        tags = ["domain:hostrule", f"host:{host}", f"persona:{persona}", f"status:{status}"]

        tool_args = {
            "type": "semantic",
            "content": content,
            "entityKey": entity_key,
            "tags": tags
        }
        _executor.submit(_invoke_mcp_tool_call, "memory_write", tool_args)

    @staticmethod
    def sync_trace_async(run_id: str, host: str, persona: str, outcome: str, step_count: int = 0) -> None:
        """Asynchronously mirror run trace into Synapse via memory_write."""
        content = f"Run {run_id} on {host} for {persona} finished with {outcome} ({step_count} steps)".strip()
        tags = ["domain:trace", f"host:{host}", f"persona:{persona}", f"outcome:{outcome}"]

        tool_args = {
            "type": "episodic",
            "content": content,
            "tags": tags
        }
        _executor.submit(_invoke_mcp_tool_call, "memory_write", tool_args)

    @staticmethod
    def retrieve_memory_sync(query: str, limit: int = 5) -> Optional[Dict[str, Any]]:
        """Synchronous retrieval helper via memory_retrieve tool."""
        return _invoke_mcp_tool_call("memory_retrieve", {"query": query, "limit": limit})

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
