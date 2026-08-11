#!/usr/bin/env python3
"""
synapse_adapter.py — Non-blocking HTTP Adapter for Synapse Memory OS.

Architecture:
- Connects to a persistent Synapse HTTP API service (default: http://127.0.0.1:8787).
- Supports external hosting (e.g. Oracle cloud migration) via SYNAPSE_API_URL and SYNAPSE_TOKEN env vars.
- Calibrated timeout: SYNAPSE_TIMEOUT_SEC = 0.15s (150ms, ~3x p95 HTTP latency of 45.5ms).
- Uses ThreadPoolExecutor for non-blocking fire-and-forget execution.
"""

import os
import sys
import json
import logging
import urllib.request
import urllib.error
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional

logger = logging.getLogger("synapse_adapter")

# Environment configuration for local & Oracle server deployment
SYNAPSE_API_URL = os.environ.get("SYNAPSE_API_URL", "http://127.0.0.1:8787").rstrip("/")
SYNAPSE_TOKEN = os.environ.get("SYNAPSE_TOKEN", "")

# Calibrated timeout: 150ms (~3x empirical p95 HTTP latency of 45.5ms)
SYNAPSE_TIMEOUT_SEC = 0.15
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


def _http_request(endpoint: str, payload: Dict[str, Any], method: str = "POST") -> Optional[Dict[str, Any]]:
    """
    Executes an HTTP request against the persistent Synapse API service.
    Fast failure (< 5ms on connection refused) guarantees main loop protection.
    """
    url = f"{SYNAPSE_API_URL}{endpoint}"
    data_bytes = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if SYNAPSE_TOKEN:
        headers["Authorization"] = f"Bearer {SYNAPSE_TOKEN}"

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    start_ts = time.time()
    try:
        with urllib.request.urlopen(req, timeout=SYNAPSE_TIMEOUT_SEC) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            _record_sync_metric(success=True)
            return result

    except urllib.error.HTTPError as err:
        logger.warning(f"[SynapseAdapter] HTTP {err.code} error for {endpoint}: {err.reason}")
        _record_sync_metric(success=False)
        return None
    except urllib.error.URLError as err:
        elapsed_ms = (time.time() - start_ts) * 1000
        logger.warning(f"[SynapseAdapter] Connection error in {elapsed_ms:.1f}ms for {endpoint}: {err.reason}")
        _record_sync_metric(success=False)
        return None
    except TimeoutError:
        elapsed_ms = (time.time() - start_ts) * 1000
        logger.warning(f"[SynapseAdapter] Timeout ({elapsed_ms:.1f}ms > {SYNAPSE_TIMEOUT_SEC*1000:.0f}ms) for {endpoint}")
        _record_sync_metric(success=False)
        return None
    except Exception as err:
        logger.warning(f"[SynapseAdapter] Exception during HTTP call to {endpoint}: {err}")
        _record_sync_metric(success=False)
        return None


class SynapseAdapter:
    """Public non-blocking API for Synapse HTTP integration."""

    @staticmethod
    def sync_fact_async(subject: str, predicate: str, object_val: str, persona: str = "*", metadata: Optional[Dict[str, Any]] = None) -> None:
        """Asynchronously mirror fact into Synapse via POST /v1/memories."""
        content = f"{subject} {predicate} {object_val}".strip()
        entity_key = f"persona.{persona}.{subject}"
        tags = ["domain:fact", f"persona:{persona}"]
        if metadata and "topic" in metadata:
            tags.append(f"topic:{metadata['topic']}")

        payload = {
            "userId": "local",
            "type": "semantic",
            "content": content,
            "entityKey": entity_key,
            "tags": tags
        }
        _executor.submit(_http_request, "/v1/memories", payload)

    @staticmethod
    def sync_rule_async(host: str, pattern: str, behavior: str, persona: str = "*", status: str = "shadow") -> None:
        """Asynchronously mirror rule into Synapse via POST /v1/memories."""
        content = f"Rule for host {host} pattern {pattern}: {behavior}".strip()
        entity_key = f"hostrule.{host}.{persona}.{pattern}"
        tags = ["domain:hostrule", f"host:{host}", f"persona:{persona}", f"status:{status}"]

        payload = {
            "userId": "local",
            "type": "semantic",
            "content": content,
            "entityKey": entity_key,
            "tags": tags
        }
        _executor.submit(_http_request, "/v1/memories", payload)

    @staticmethod
    def sync_trace_async(run_id: str, host: str, persona: str, outcome: str, step_count: int = 0) -> None:
        """Asynchronously mirror run trace into Synapse via POST /v1/memories."""
        content = f"Run {run_id} on {host} for {persona} finished with {outcome} ({step_count} steps)".strip()
        tags = ["domain:trace", f"host:{host}", f"persona:{persona}", f"outcome:{outcome}"]

        payload = {
            "userId": "local",
            "type": "episodic",
            "content": content,
            "tags": tags
        }
        _executor.submit(_http_request, "/v1/memories", payload)

    @staticmethod
    def retrieve_memory_sync(query: str, limit: int = 5) -> Optional[Dict[str, Any]]:
        """Synchronous retrieval helper via POST /v1/memories/retrieve."""
        return _http_request("/v1/memories/retrieve", {"userId": "local", "query": query, "limit": limit})

    @staticmethod
    def get_metrics() -> Dict[str, Any]:
        """Fetch current sync metrics from SQLite app_settings and health check."""
        try:
            import persona_graph_memory
            conn = persona_graph_memory._connect()
            rows = conn.execute("SELECT key, value FROM app_settings WHERE key LIKE 'synapse_%'").fetchall()
            conn.close()
            metrics = {r[0]: r[1] for r in rows}
            
            # Quick 50ms HTTP health check
            is_online = False
            try:
                req = urllib.request.Request(f"{SYNAPSE_API_URL}/health")
                with urllib.request.urlopen(req, timeout=0.05) as resp:
                    if resp.status == 200:
                        is_online = True
            except Exception:
                is_online = False

            return {
                "last_sync_ts": metrics.get("synapse_last_sync_ts", None),
                "failures": int(metrics.get("synapse_sync_failures", 0)),
                "status": "online" if is_online else "offline",
                "api_url": SYNAPSE_API_URL
            }
        except Exception:
            return {"status": "error", "failures": 0, "last_sync_ts": None, "api_url": SYNAPSE_API_URL}
