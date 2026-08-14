"""Unit tests for pending tasks persistence in SQLite (Feature 017)."""

import os
import time
import pytest
import persona_graph_memory


def test_pending_tasks_crud():
    # Ensure clean state for test task
    test_id = f"test_task_{int(time.time() * 1000)}"
    persona_graph_memory.delete_pending_task(test_id)

    task_payload = {
        "id": test_id,
        "profile": "arno",
        "profile_name": "Арсен",
        "url": "https://meinungsplatz.ch/survey/123",
        "reward": "1.5 CHF",
        "duration": "8 min",
        "created_at": "16:00:00",
        "created_timestamp": time.time(),
        "wait_expires_at": "2026-08-14T16:10:00",
        "status": "waiting_auth"
    }

    # 1. Add task
    persona_graph_memory.add_pending_task(task_payload)

    # 2. Retrieve tasks
    tasks = persona_graph_memory.get_pending_tasks()
    found = [t for t in tasks if t["id"] == test_id]
    assert len(found) == 1, "Task should be found in SQLite"
    assert found[0]["reward"] == "1.5 CHF"
    assert found[0]["profile"] == "arno"

    # 3. Update status
    persona_graph_memory.update_pending_task_status(test_id, "running")
    running_tasks = persona_graph_memory.get_pending_tasks(status="running")
    assert any(t["id"] == test_id for t in running_tasks), "Status should be updated to running"

    # 4. Delete task
    deleted = persona_graph_memory.delete_pending_task(test_id)
    assert deleted is True, "delete_pending_task should return True"

    remaining = [t for t in persona_graph_memory.get_pending_tasks() if t["id"] == test_id]
    assert len(remaining) == 0, "Task should be deleted from SQLite"
