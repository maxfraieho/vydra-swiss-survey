"""Integration tests for Feature 008 — Fallback Browser Sources.
Verifies priority ordering, CDP sequential fallback, and multi-tab close() cleanup."""

import unittest.mock as mock
import pytest
import persona_graph_memory
from cdp_client import CDPClient, CDPError


def _get_or_create_browser_source(key: str, label: str, host: str, port: int) -> dict:
    existing = persona_graph_memory.get_browser_source_by_key(key)
    if existing:
        return existing
    return persona_graph_memory.create_browser_source(
        key=key, label=label, kind="direct_cdp", host=host, port=port
    )


def test_priority_migration_and_query():
    """Verify get_active_browser_sources returns active sources ordered by priority ASC."""
    persona_graph_memory._connect()

    s1 = _get_or_create_browser_source("test_laptop_30", "Laptop .30", "192.168.3.30", 9226)
    s2 = _get_or_create_browser_source("test_dev_184", "Dev 184", "192.168.3.184", 9226)

    persona_graph_memory.set_active_browser_source(s1["id"], active=True, priority=1)
    persona_graph_memory.set_active_browser_source(s2["id"], active=True, priority=2)

    active_sources = persona_graph_memory.get_active_browser_sources()
    assert len(active_sources) >= 2
    test_sources = [s for s in active_sources if s["key"].startswith("test_")]
    priorities = [s["priority"] for s in test_sources]
    assert priorities == sorted(priorities)


def test_cdp_client_fallback_loop():
    """Verify CDPClient falls back to Priority 2 when Priority 1 is unreachable."""
    persona_graph_memory._connect()

    # Deactivate pre-existing active sources for clean test isolation
    sources = persona_graph_memory.list_browser_sources()
    for s in sources:
        persona_graph_memory.set_active_browser_source(s["id"], active=False)

    s1 = _get_or_create_browser_source("fallback_test_p1", "Broken P1 Host", "192.168.3.250", 9999)
    s2 = _get_or_create_browser_source("fallback_test_p2", "Working P2 Host", "127.0.0.1", 9226)

    persona_graph_memory.set_active_browser_source(s1["id"], active=True, priority=1)
    persona_graph_memory.set_active_browser_source(s2["id"], active=True, priority=2)

    def mock_ensure_tunnel(host, remote_port, local_port):
        if host == "192.168.3.250":
            raise CDPError("Host 192.168.3.250 unreachable")
        return remote_port

    with mock.patch("cdp_client.ensure_tunnel", side_effect=mock_ensure_tunnel):
        client = CDPClient(local_port=9226)
        assert client.active_source["key"] == "fallback_test_p2"
        assert client.active_source["priority"] == 2


def test_cdp_client_multi_tab_cleanup():
    """Verify close() sends /json/close for ALL target IDs in opened_target_ids."""
    persona_graph_memory._connect()
    sources = persona_graph_memory.list_browser_sources()
    for s in sources:
        persona_graph_memory.set_active_browser_source(s["id"], active=False)

    src = _get_or_create_browser_source("cleanup_test_src", "Cleanup Test Host", "127.0.0.1", 9226)
    persona_graph_memory.set_active_browser_source(src["id"], active=True, priority=1)

    closed_target_ids = []

    def mock_get(url, **kwargs):
        if "/json/close/" in url:
            tid = url.split("/json/close/")[-1]
            closed_target_ids.append(tid)
            resp = mock.MagicMock()
            resp.ok = True
            return resp
        resp = mock.MagicMock()
        resp.ok = True
        return resp

    with mock.patch("cdp_client.ensure_tunnel", return_value=9226), \
         mock.patch("requests.get", side_effect=mock_get):

        client = CDPClient(local_port=9226)
        client.target_id = "target_tab_1"
        client.opened_target_ids.add("target_tab_1")
        client.opened_target_ids.add("target_tab_2")
        client.opened_target_ids.add("target_tab_3")

        client.close()

        assert "target_tab_1" in closed_target_ids
        assert "target_tab_2" in closed_target_ids
        assert "target_tab_3" in closed_target_ids
