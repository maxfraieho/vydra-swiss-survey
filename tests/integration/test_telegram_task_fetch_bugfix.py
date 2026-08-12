"""Integration tests for Feature 016 — Telegram Task Fetching & Payload Extraction Bugfix."""

import pytest
import astryx_survey_server


def test_extract_text_and_url_from_caption():
    """Verify extract_text_and_url_from_payload extracts text and clean URL from caption payload."""
    payload = {
        "message": {
            "caption": "Нове опитування на https://sb.ktrmr.com/mrIWeb/mrIWeb.srf).",
            "chat": {"id": 12345678}
        }
    }
    text, url = astryx_survey_server.extract_text_and_url_from_payload(payload)
    assert text == "Нове опитування на https://sb.ktrmr.com/mrIWeb/mrIWeb.srf)."
    assert url == "https://sb.ktrmr.com/mrIWeb/mrIWeb.srf"


def test_extract_text_and_url_from_text_link_entity():
    """Verify text_link entity URL extraction and task creation."""
    payload = {
        "channel_post": {
            "text": "Опитування для Арно 2.5 CHF",
            "entities": [
                {
                    "type": "text_link",
                    "url": "https://sb.ktrmr.com/mrIWeb/mrIWeb.srf?id=test1234"
                }
            ]
        }
    }
    text, url = astryx_survey_server.extract_text_and_url_from_payload(payload)
    assert url == "https://sb.ktrmr.com/mrIWeb/mrIWeb.srf?id=test1234"

    task = astryx_survey_server.push_task_from_text(text, force=True, override_url=url)
    assert task["profile"] == "arno"
    assert task["url"] == "https://sb.ktrmr.com/mrIWeb/mrIWeb.srf?id=test1234"
    assert task["reward"] == "2.5 CHF"
