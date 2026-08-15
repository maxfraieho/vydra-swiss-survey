"""Boundary between pipeline B (execution, ``survey_agent.py``) and pipeline A
(learning, ``astryx_survey_server.py``) — SDD 022, R1.

Pure extraction: every function below is the verbatim body of an inline block
that used to live in the hot step loop of ``survey_agent.py``
(``:310-333`` for :func:`verify_step`, ``:228-269`` for :func:`report_blocking`,
:func:`poll_operator_status` and :func:`report_running`).

Equivalence conditions that MUST hold (checked by SDD 022 gate G6):

* same endpoint ``http://127.0.0.1:5005/api/survey/verify_step``;
* same timeout of 300 s;
* same ``X-Astryx-Token`` header sourced from ``ASTRYX_API_TOKEN``;
* same ``page_text[:2000]`` truncation;
* same blanket ``except Exception: pass`` — a tutor that is down must never
  interrupt an autonomous run.

SDD 023A/F10 keeps that last guarantee byte-for-byte (the failure is still
swallowed and the step still proceeds autonomously) but stops the failure from
being *silent*: it is counted in :data:`TUTOR_BRIDGE_STATE` and written to the
agent's stdout. stdout is the channel that actually reaches the operator,
because ``survey_agent.py`` runs as a subprocess of the server
(``astryx_survey_server.run_survey_execution`` -> ``subprocess.Popen``) whose
output is piped line-by-line into ``add_log()`` -> ``log_history`` -> the UI.
"""
from __future__ import annotations

import datetime as _dt
import json as _json
import os
import sys as _sys
import urllib.request

import run_state

VERIFY_ENDPOINT = "http://127.0.0.1:5005/api/survey/verify_step"
VERIFY_TIMEOUT = 300

#: 023A/F10 — observability for the learning-pipeline bridge. Bookkeeping only:
#: nothing here can raise, block or change control flow.
TUTOR_BRIDGE_STATE: dict = {
    "failures": 0,
    "consecutive_failures": 0,
    "last_error": None,
    "last_error_at": None,
    "last_ok_at": None,
}


def reset_tutor_bridge_state() -> None:
    """Zero the F10 counters (used by tests and at the start of a run)."""
    TUTOR_BRIDGE_STATE.update(failures=0, consecutive_failures=0,
                              last_error=None, last_error_at=None, last_ok_at=None)


def _publish_bridge_state() -> None:
    """Mirror the counters into ACTIVE_SURVEY_STATE when we share a process
    with the server (tests, in-process callers). A no-op in the subprocess
    case, where stdout is the real channel — hence the separate log line.

    Deliberately reads sys.modules instead of importing: inside the agent
    subprocess the server module is not loaded, and importing it there costs
    ~4s of flask/blueprint import for a dict that nobody in that process will
    ever read.
    """
    try:
        srv = _sys.modules.get("astryx_survey_server")
        if srv is None:
            return
        with srv.STATE_LOCK:
            srv.ACTIVE_SURVEY_STATE["tutor_bridge"] = dict(TUTOR_BRIDGE_STATE)
    except Exception:
        pass


def _note_bridge_failure(exc: BaseException, step, log=None) -> None:
    """Record + surface a bridge failure. MUST NOT raise and MUST NOT block."""
    try:
        TUTOR_BRIDGE_STATE["failures"] += 1
        TUTOR_BRIDGE_STATE["consecutive_failures"] += 1
        TUTOR_BRIDGE_STATE["last_error"] = f"{type(exc).__name__}: {exc}"[:500]
        TUTOR_BRIDGE_STATE["last_error_at"] = _dt.datetime.now().isoformat(timespec="seconds")
        msg = (f"⚠️ [TutorBridge] verify_step FAILED at step {step} "
               f"({TUTOR_BRIDGE_STATE['consecutive_failures']} in a row, "
               f"{TUTOR_BRIDGE_STATE['failures']} this run): "
               f"{TUTOR_BRIDGE_STATE['last_error']} — the step proceeds "
               f"AUTONOMOUSLY, without tutor verification.")
        if log:
            log(msg)
        else:
            print(f"[pipeline_bridge] {msg}", flush=True)
        _publish_bridge_state()
    except Exception:
        pass


def _note_bridge_success() -> None:
    try:
        TUTOR_BRIDGE_STATE["consecutive_failures"] = 0
        TUTOR_BRIDGE_STATE["last_ok_at"] = _dt.datetime.now().isoformat(timespec="seconds")
        _publish_bridge_state()
    except Exception:
        pass


def verify_step(*, step, shot_path, decision, profile, url, page_text, pattern,
                endpoint: str = VERIFY_ENDPOINT,
                timeout: int = VERIFY_TIMEOUT,
                log=None):
    """Synchronous bridge to the learning pipeline.

    Returns the dict of override fields sent back by the tutor, or ``None`` when
    the tutor is unreachable / returned nothing to override.  ``decision`` is
    mutated in place exactly as the original inline block did.  Any network
    error is swallowed (023A/F10: swallowed, but counted in TUTOR_BRIDGE_STATE
    and logged — never silent).
    """
    try:
        req = urllib.request.Request(endpoint,
                                     data=_json.dumps({
                                         "step": step,
                                         "shot_path": shot_path,
                                         "decision": decision,
                                         "profile": profile,
                                         "url": url,
                                         "page_text": page_text[:2000],
                                         "pattern": pattern
                                     }).encode("utf-8"),
                                     headers={"Content-Type": "application/json",
                                              "X-Astryx-Token": os.environ.get("ASTRYX_API_TOKEN", "")})
        resp = urllib.request.urlopen(req, timeout=timeout)
        verif_res = _json.loads(resp.read().decode("utf-8"))
        _note_bridge_success()
        if verif_res.get("override_action"):
            decision["action"] = verif_res.get("override_action")
            decision["target_text"] = verif_res.get("override_target", decision.get("target_text"))
            decision["value"] = verif_res.get("override_value", decision.get("value"))
            if log:
                log(f"[Verification Override] step {step}: action={decision['action']} target={decision['target_text']}")
            return verif_res
    except Exception as _bridge_err:
        # 023A/F10: still swallowed on purpose — a tutor that is down must never
        # interrupt an autonomous run — but no longer silent.
        _note_bridge_failure(_bridge_err, step, log)
    return None


def report_blocking(reason_code, decision) -> None:
    """Park the run in ``waiting_verification`` and hand ``decision`` to the operator."""
    try:
        import astryx_survey_server
        with astryx_survey_server.STATE_LOCK:
            run_state.check_transition(
                astryx_survey_server.ACTIVE_SURVEY_STATE.get("status"),
                run_state.WAITING_VERIFICATION,
                where="pipeline_bridge.report_blocking",
            )
            astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = run_state.WAITING_VERIFICATION
            astryx_survey_server.ACTIVE_SURVEY_STATE["reason_code"] = reason_code
            astryx_survey_server.ACTIVE_SURVEY_STATE["pending_decision"] = decision
    except Exception:
        pass


def poll_operator_status():
    """Current run status as seen by the server module, or ``None`` if unreadable."""
    try:
        import astryx_survey_server
        with astryx_survey_server.STATE_LOCK:
            return astryx_survey_server.ACTIVE_SURVEY_STATE.get("status")
    except Exception:
        return None


def report_running() -> None:
    """Clear the blocking state and resume the run."""
    try:
        import astryx_survey_server
        with astryx_survey_server.STATE_LOCK:
            run_state.check_transition(
                astryx_survey_server.ACTIVE_SURVEY_STATE.get("status"),
                run_state.RUNNING,
                where="pipeline_bridge.report_running",
            )
            astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = run_state.RUNNING
            astryx_survey_server.ACTIVE_SURVEY_STATE["reason_code"] = None
            astryx_survey_server.ACTIVE_SURVEY_STATE["pending_decision"] = None
    except Exception:
        pass
