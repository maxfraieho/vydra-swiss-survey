"""Regression tests for SDD 023 Track A — the seven execution-pipeline defects
F6, F7, F9, F10, F11, F13, F14.

Unlike SDD 022 (behaviour-preserving), these encode INTENTIONAL behaviour
changes: each test fails against the pre-023A code and passes after the fix.

``survey_agent.main()`` is driven end-to-end against fakes (CDP, vision, the
tutor bridge and a throwaway sqlite graph DB), because every one of these
defects lives in the wiring of the step loop rather than in a leaf function.
"""
from __future__ import annotations

import os
import sys
import tempfile
import types

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import persona_graph_memory  # noqa: E402
import pipeline_bridge  # noqa: E402
import run_state  # noqa: E402
import survey_agent  # noqa: E402
from cdp_client import CDPError  # noqa: E402

START_URL = "https://example-panel.test/start"


class FakeCDP:
    """Minimal stand-in for CDPClient covering everything main() touches."""

    def __init__(self, urls=None, new_tab_after_click=None, captchas=None):
        self.base = "http://127.0.0.1:0"
        self._urls = list(urls or [])
        self.target_id = "tab-0"
        self._tab_ids = ["tab-0"]
        self._new_tab_after_click = new_tab_after_click
        self._captchas = list(captchas or [])
        self.current = START_URL
        self.clicks = []
        self.typed = []
        self.closed = False
        self.new_tab_calls = []

    # --- attach / navigate -------------------------------------------------
    def attach_or_open_tab(self, url):
        return False

    def attach_exact_tab(self, url):
        return True

    def navigate(self, url):
        self.current = url

    # --- observation -------------------------------------------------------
    def get_current_url(self):
        if self._urls:
            self.current = self._urls.pop(0)
        return self.current

    def detect_captcha_signatures(self):
        return self._captchas.pop(0) if self._captchas else []

    def screenshot(self, path):
        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")
        return path

    def page_text(self, limit=2000):
        return "Wie alt sind Sie? Frage 1"

    # --- actions -----------------------------------------------------------
    def click_by_text(self, text):
        self.clicks.append(text)
        if self._new_tab_after_click and text == self._new_tab_after_click:
            self._tab_ids.append("tab-NEW")
        return True

    def type_text(self, value):
        self.typed.append(value)

    def scroll(self):
        pass

    def find_submit_button(self):
        return None

    # --- tab bookkeeping (F7) ---------------------------------------------
    def list_page_target_ids(self):
        return set(self._tab_ids)

    def check_and_attach_new_tab(self, known_target_ids=None):
        self.new_tab_calls.append(known_target_ids)
        for tid in reversed(self._tab_ids):
            if tid == self.target_id:
                continue
            if known_target_ids is not None and tid in known_target_ids:
                continue
            self.target_id = tid
            self.current = "https://provider.test/survey?tab=new"
            return self.current
        return None

    def close(self, close_tabs=False):
        self.closed = True


class FakeVision:
    def __init__(self, decisions):
        self._decisions = list(decisions)
        self.calls = 0

    def decide_action(self, shot_path, persona, step):
        self.calls += 1
        item = self._decisions.pop(0) if self._decisions else {"action": "done"}
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture
def rig(tmp_path, monkeypatch):
    """Isolated graph DB + neutralised side effects; returns a helper object."""
    monkeypatch.setattr(persona_graph_memory, "DB_PATH", str(tmp_path / "graph.db"))
    monkeypatch.setattr(persona_graph_memory, "get_persona",
                        lambda key: {"content_md": "persona body"})
    monkeypatch.setattr(persona_graph_memory, "get_enhanced_persona",
                        lambda key, content, url: (content, []))
    monkeypatch.setattr(persona_graph_memory, "list_patterns", lambda: [])
    monkeypatch.setattr(survey_agent, "load_credentials", lambda host, prof: None)
    _orig_mkdtemp = tempfile.mkdtemp
    monkeypatch.setattr(survey_agent.tempfile, "mkdtemp",
                        lambda **kw: _orig_mkdtemp(dir=str(tmp_path)))
    # keep ~/latest_survey_step.png untouched
    monkeypatch.setenv("HOME", str(tmp_path))

    verify_calls = []
    monkeypatch.setattr(pipeline_bridge, "verify_step",
                        lambda **kw: verify_calls.append(kw))
    monkeypatch.setattr(pipeline_bridge, "report_blocking", lambda *a, **kw: None)
    monkeypatch.setattr(pipeline_bridge, "report_running", lambda *a, **kw: None)

    holder = types.SimpleNamespace(verify_calls=verify_calls, client=None,
                                   vision=None, statuses=None)

    def run(decisions, *, urls=None, new_tab_after_click=None, captchas=None,
            max_steps=6, extra_argv=()):
        holder.client = FakeCDP(urls=urls, new_tab_after_click=new_tab_after_click,
                                captchas=captchas)
        holder.vision = FakeVision(decisions)
        monkeypatch.setattr(survey_agent, "CDPClient",
                            lambda *a, **kw: holder.client)
        monkeypatch.setattr(survey_agent, "GemmaVision",
                            lambda *a, **kw: holder.vision)
        argv = ["survey_agent.py", "--profile", "arno", "--url", START_URL,
                "--force", "--max-steps", str(max_steps), *extra_argv]
        monkeypatch.setattr(sys, "argv", argv)
        survey_agent.main()
        return holder

    holder.run = run
    return holder


# --------------------------------------------------------------------------
# F6 — current_url must track the page, not the start URL
# --------------------------------------------------------------------------
def test_f6_verify_step_receives_the_current_url_not_the_start_url(rig):
    later = "https://provider.test/q/3"
    rig.run([{"action": "scroll"}, {"action": "done"}],
            urls=[START_URL, START_URL, later, later])
    urls = [c["url"] for c in rig.verify_calls]
    assert urls, "verify_step was never called"
    assert later in urls, (
        f"current_url never advanced past the start page; verify_step saw {urls}")


# --------------------------------------------------------------------------
# F7 — a click that opens a new tab must re-target the client
# --------------------------------------------------------------------------
def test_f7_new_tab_after_click_is_attached(rig):
    rig.run([{"action": "click", "target_text": "Umfrage starten"},
             {"action": "done"}],
            new_tab_after_click="Umfrage starten")
    assert rig.client.new_tab_calls, (
        "check_and_attach_new_tab() was never called after a click")
    assert rig.client.target_id == "tab-NEW", (
        f"agent kept screenshotting the old tab (target_id={rig.client.target_id})")


def test_f7_pre_existing_unrelated_tab_is_not_hijacked(rig):
    """The guard matters: without a known-ids snapshot the dead method would
    grab any other tab in the shared CDP pool (someone's manual browsing tab)."""
    rig.run([{"action": "click", "target_text": "Weiter"}, {"action": "done"}])
    rig.client._tab_ids.append("tab-UNRELATED")
    assert rig.client.target_id == "tab-0"


# --------------------------------------------------------------------------
# F9 — a vision exception must not end the run
# --------------------------------------------------------------------------
def test_f9_single_vision_exception_does_not_end_the_run(rig, monkeypatch):
    monkeypatch.setattr(survey_agent, "VISION_RETRY_BACKOFF_SECONDS", 0.01, raising=False)
    monkeypatch.setattr(survey_agent, "VISION_WAIT_SECONDS", 0.01, raising=False)
    rig.run([RuntimeError("proxy timeout"),
             {"action": "scroll"},
             {"action": "done"}], max_steps=8)
    # The run must have continued past the failing step and reached 'done'.
    assert rig.vision.calls >= 3, (
        f"run stopped after the vision error (only {rig.vision.calls} vision calls)")


def test_f9_persistent_vision_failure_stops_cleanly(rig, monkeypatch):
    monkeypatch.setattr(survey_agent, "VISION_RETRY_BACKOFF_SECONDS", 0.01, raising=False)
    monkeypatch.setattr(survey_agent, "VISION_WAIT_SECONDS", 0.01, raising=False)
    rig.run([RuntimeError("proxy down")] * 40, max_steps=8)
    # Must terminate, not spin forever, and not raise.
    assert rig.client.closed
    # Retried within each step rather than giving up on the first exception.
    assert rig.vision.calls >= getattr(survey_agent, "VISION_MAX_ATTEMPTS", 1) * 2, (
        f"no in-step retry happened (vision calls={rig.vision.calls})")


# --------------------------------------------------------------------------
# F10 — tutor-bridge failure must be visible, but must never block
# --------------------------------------------------------------------------
def test_f10_bridge_failure_is_recorded_and_swallowed(monkeypatch):
    pipeline_bridge.reset_tutor_bridge_state()
    logged = []
    res = pipeline_bridge.verify_step(
        step=1, shot_path="/nonexistent.png", decision={"action": "click"},
        profile="arno", url=START_URL, page_text="x", pattern=None,
        endpoint="http://127.0.0.1:1/api/survey/verify_step", timeout=1,
        log=logged.append)
    assert res is None, "a down tutor must not change the return contract"
    state = pipeline_bridge.TUTOR_BRIDGE_STATE
    assert state["failures"] == 1
    assert state["consecutive_failures"] == 1
    assert state["last_error"], "the error text must be captured"
    assert any("TutorBridge" in m for m in logged), (
        f"failure was not surfaced to the operator log: {logged}")


def test_f10_state_field_is_exposed_by_the_server(monkeypatch):
    import astryx_survey_server
    assert "tutor_bridge" in astryx_survey_server.ACTIVE_SURVEY_STATE


# --------------------------------------------------------------------------
# F11 — operator pause must stop the agent outside the captcha branch
# --------------------------------------------------------------------------
def test_f11_paused_blocks_the_loop_outside_captcha(rig, monkeypatch):
    seen = {"polls": 0}

    def fake_status():
        seen["polls"] += 1
        # paused for the first few polls of step 1, then resumed
        return run_state.PAUSED if seen["polls"] <= 3 else run_state.RUNNING

    monkeypatch.setattr(pipeline_bridge, "poll_operator_status_live", fake_status)
    monkeypatch.setattr(survey_agent, "PAUSE_POLL_SECONDS", 0.01, raising=False)
    rig.run([{"action": "scroll"}, {"action": "done"}])
    assert seen["polls"] >= 4, (
        f"the loop never re-polled while paused (polls={seen['polls']}) — "
        "pause outside the captcha branch is still a no-op")


def test_f11_status_is_read_over_http_not_from_a_fresh_module(monkeypatch):
    """survey_agent runs as a subprocess of the server, so an in-process
    ``import astryx_survey_server`` yields a fresh ACTIVE_SURVEY_STATE that is
    always 'idle'. The live poll must therefore prefer HTTP."""
    calls = []
    monkeypatch.setattr(pipeline_bridge, "poll_operator_status_http",
                        lambda *a, **kw: calls.append("http") or run_state.PAUSED)
    assert pipeline_bridge.poll_operator_status_live() == run_state.PAUSED
    assert calls == ["http"]


def test_f11_falls_back_to_in_process_when_http_is_unreachable(monkeypatch):
    monkeypatch.setattr(pipeline_bridge, "poll_operator_status_http",
                        lambda *a, **kw: None)
    monkeypatch.setattr(pipeline_bridge, "poll_operator_status",
                        lambda: run_state.RUNNING)
    assert pipeline_bridge.poll_operator_status_live() == run_state.RUNNING


# --------------------------------------------------------------------------
# F13 — a browser_sources failure must close the run_traces row
# --------------------------------------------------------------------------
def test_f13_cdp_setup_failure_closes_the_run_trace(tmp_path, monkeypatch):
    monkeypatch.setattr(persona_graph_memory, "DB_PATH", str(tmp_path / "graph.db"))
    monkeypatch.setattr(persona_graph_memory, "get_persona",
                        lambda key: {"content_md": "persona body"})
    monkeypatch.setattr(persona_graph_memory, "get_enhanced_persona",
                        lambda key, content, url: (content, []))
    monkeypatch.setattr(survey_agent, "load_credentials", lambda host, prof: None)

    def boom(*a, **kw):
        raise CDPError("All configured active browser sources in fallback chain failed!")

    monkeypatch.setattr(survey_agent, "CDPClient", boom)
    monkeypatch.setattr(sys, "argv",
                        ["survey_agent.py", "--profile", "arno", "--url", START_URL,
                         "--force"])
    with pytest.raises(CDPError):
        survey_agent.main()

    import sqlite3
    conn = sqlite3.connect(str(tmp_path / "graph.db"))
    rows = conn.execute(
        "SELECT run_id, outcome, outcome_reason FROM run_traces").fetchall()
    conn.close()
    assert rows, "start_run_trace() did not create a row — test setup is wrong"
    assert all(r[1] for r in rows), (
        f"run_traces row left eternally open with outcome=NULL: {rows}")
    assert rows[0][1] == "error"
    assert "setup_failed" in (rows[0][2] or "")


# --------------------------------------------------------------------------
# F14 — real answers typed during a run must become durable facts
# --------------------------------------------------------------------------
def test_f14_typed_answers_are_recorded_as_facts(rig, tmp_path):
    rig.run([{"action": "type", "target_text": "Ihr Beruf", "value": "Elektriker"},
             {"action": "done"}])
    facts = persona_graph_memory.get_facts("arno")
    assert facts, "no facts were recorded from the production path"
    assert facts.get("ihr_beruf") == "Elektriker", facts


def test_f14_credentials_are_never_persisted_as_facts():
    steps = [
        {"a": "type", "tg": "Passwort", "v": "hunter2"},
        {"a": "type", "tg": "Email", "v": "arno@example.test"},
        {"a": "type", "tg": "Ihr Beruf", "v": "Elektriker"},
    ]
    facts = survey_agent.extract_learned_facts(
        steps, creds={"email": "arno@example.test", "password": "hunter2"})
    assert "hunter2" not in facts.values()
    assert "arno@example.test" not in facts.values()
    assert facts == {"ihr_beruf": "Elektriker"}
