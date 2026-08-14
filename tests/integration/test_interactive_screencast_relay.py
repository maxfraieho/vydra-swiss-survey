"""Integration tests for Feature 018: Interactive Screencast & Desktop Tutor Relay."""

import json
import pytest
from unittest.mock import patch, MagicMock
from astryx_survey_server import app, ACTIVE_SURVEY_STATE, STATE_LOCK
import persona_graph_memory


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_relay_action_validation(client):
    # Test invalid payload
    resp = client.post(
        "/api/survey/relay_action",
        data=json.dumps({}),
        content_type="application/json"
    )
    assert resp.status_code == 400
    assert "error" in json.loads(resp.data)


@patch("astryx_survey_server.get_cdp_client_for_relay")
def test_relay_action_click_and_type(mock_get_cdp, client):
    mock_cdp = MagicMock()
    mock_get_cdp.return_value = mock_cdp

    # Set active training state
    with STATE_LOCK:
        ACTIVE_SURVEY_STATE["status"] = "waiting_verification"
        ACTIVE_SURVEY_STATE["training_mode"] = True
        ACTIVE_SURVEY_STATE["profile"] = "annet"
        ACTIVE_SURVEY_STATE["url"] = "https://meinungsplatz.ch/test"

    # Test click relay
    resp_click = client.post(
        "/api/survey/relay_action",
        data=json.dumps({
            "action": "click",
            "x": 420.5,
            "y": 180.2
        }),
        content_type="application/json"
    )
    assert resp_click.status_code == 200
    data_click = json.loads(resp_click.data)
    assert data_click["status"] == "success"
    mock_cdp.human_click.assert_called_once_with(420.5, 180.2)

    # Test type relay
    resp_type = client.post(
        "/api/survey/relay_action",
        data=json.dumps({
            "action": "type",
            "text": "SecretCode123"
        }),
        content_type="application/json"
    )
    assert resp_type.status_code == 200
    data_type = json.loads(resp_type.data)
    assert data_type["status"] == "success"
    mock_cdp.type_text.assert_called_once_with("SecretCode123")

    # Test keypress relay
    resp_key = client.post(
        "/api/survey/relay_action",
        data=json.dumps({
            "action": "keypress",
            "key": "Enter"
        }),
        content_type="application/json"
    )
    assert resp_key.status_code == 200
    assert json.loads(resp_key.data)["status"] == "success"


@patch("astryx_survey_server.get_cdp_client_for_relay")
def test_relay_action_scroll(mock_get_cdp, client):
    mock_cdp = MagicMock()
    mock_get_cdp.return_value = mock_cdp

    resp_scroll = client.post(
        "/api/survey/relay_action",
        data=json.dumps({
            "action": "scroll",
            "scroll_x": 0,
            "scroll_y": 350
        }),
        content_type="application/json"
    )
    assert resp_scroll.status_code == 200
    data_scroll = json.loads(resp_scroll.data)
    assert data_scroll["status"] == "success"
    mock_cdp.scroll.assert_called_once_with(dx=0, dy=350)
