"""Integration tests for Feature 017: Survey Workflow State Cleanup & Task Persistence."""

import json
import pytest
from astryx_survey_server import app, ACTIVE_SURVEY_STATE, PENDING_TASKS, STATE_LOCK, clear_active_survey_state
import persona_graph_memory


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_state_cleanup_and_reset_endpoint(client):
    # Set dirty state
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "waiting_verification"
        ACTIVE_SURVEY_STATE["pending_step"] = 1
        ACTIVE_SURVEY_STATE["pending_decision"] = {"action": "WAIT"}
        ACTIVE_SURVEY_STATE["pending_page_text"] = "Error 404 - Stale Page Text"
        ACTIVE_SURVEY_STATE["pending_pattern"] = "nav:error"
        ACTIVE_SURVEY_STATE["active_task_id"] = "task_test_123"

    # Verify state is populated
    resp = client.get("/api/survey/status")
    data = json.loads(resp.data)
    assert data["pending_step"] == 1
    assert data["pending_page_text"] == "Error 404 - Stale Page Text"

    # Reset state via API
    resp_reset = client.post("/api/survey/reset_state")
    assert resp_reset.status_code == 200
    reset_data = json.loads(resp_reset.data)
    assert reset_data["status"] == "success"

    # Verify state is completely clean
    resp_after = client.get("/api/survey/status")
    data_after = json.loads(resp_after.data)
    assert data_after["status"] == "idle"
    assert data_after["pending_step"] is None
    assert data_after["pending_decision"] is None
    assert data_after["pending_page_text"] is None
    assert data_after["active_task_id"] is None


def test_trigger_and_delete_pending_task_persistence(client):
    test_url = "https://meinungsplatz.ch/survey/email_invite_789"
    resp = client.post(
        "/api/survey/trigger",
        data=json.dumps({
            "profile": "annet",
            "url": test_url,
            "reward": "2.0 CHF",
            "duration": "12 min"
        }),
        content_type="application/json"
    )
    assert resp.status_code == 200
    res_data = json.loads(resp.data)
    assert res_data["status"] == "success"
    task_id = res_data["task"]["id"]

    # Verify task exists in SQLite DB
    db_tasks = persona_graph_memory.get_pending_tasks()
    found = [t for t in db_tasks if t["id"] == task_id]
    assert len(found) == 1
    assert found[0]["profile"] == "annet"
    assert found[0]["url"] == test_url

    # Delete task via API
    del_resp = client.delete(f"/api/survey/pending_tasks/{task_id}")
    assert del_resp.status_code == 200

    # Verify task is removed from SQLite DB
    db_tasks_after = persona_graph_memory.get_pending_tasks()
    assert not any(t["id"] == task_id for t in db_tasks_after)
