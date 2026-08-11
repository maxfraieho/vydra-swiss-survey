import pytest
import datetime
import astryx_survey_server

def test_push_task_from_text_parsing_arsen():
    """
    Test parsing of real Telegram notification text for Arsen:
    '🔔 Нове завдання для Арсена 💰 Винагорода: 0.9 CHF ⏱ Тривалість: 6 min'
    """
    text = "🔔 Нове завдання для Арсена\n💰 Винагорода: 0.9 CHF\n⏱ Тривалість: 6 min"
    
    # Reset pending tasks and active state for clean test environment
    astryx_survey_server.PENDING_TASKS.clear()
    astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = "idle"
    astryx_survey_server.ACTIVE_SURVEY_STATE["active_task_id"] = None
    
    task = astryx_survey_server.push_task_from_text(text)
    
    assert task is not None, "Failed to parse task from Telegram text"
    assert task["profile"] == "arno"
    assert task["reward"] == "0.9 CHF"
    assert task["duration"] == "6 min"
    assert task["url"] == "https://meinungsplatz.ch/"
    assert astryx_survey_server.ACTIVE_SURVEY_STATE["status"] == "waiting_auth"
    assert astryx_survey_server.ACTIVE_SURVEY_STATE["active_task_id"] == task["id"]

def test_push_task_consecutive_tasks_not_blocked():
    """
    Regression Test:
    Verify that receiving a new task notification for the same profile (arno)
    does NOT get silently discarded by overly aggressive reward deduplication
    when the previous task was already selected, completed, or starting.
    """
    text1 = "🔔 Нове завдання для Арсена\n💰 Винагорода: 0.9 CHF\n⏱ Тривалість: 6 min"
    text2 = "🔔 Нове завдання для Арсена\n💰 Винагорода: 0.9 CHF\n⏱ Тривалість: 6 min"
    
    astryx_survey_server.PENDING_TASKS.clear()
    astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = "idle"
    astryx_survey_server.ACTIVE_SURVEY_STATE["active_task_id"] = None
    
    task1 = astryx_survey_server.push_task_from_text(text1)
    assert task1 is not None
    
    # Simulate user selecting or completing task1
    astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = "starting"
    
    # Second notification arrives for Arsen with 0.9 CHF
    task2 = astryx_survey_server.push_task_from_text(text2)
    
    assert task2 is not None, "Second task for same profile/reward was wrongly discarded by duplicate filter!"
    assert task2["id"] != task1["id"]
