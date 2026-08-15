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
"""
from __future__ import annotations

import json as _json
import os
import urllib.request

import run_state

VERIFY_ENDPOINT = "http://127.0.0.1:5005/api/survey/verify_step"
VERIFY_TIMEOUT = 300


def verify_step(*, step, shot_path, decision, profile, url, page_text, pattern,
                endpoint: str = VERIFY_ENDPOINT,
                timeout: int = VERIFY_TIMEOUT,
                log=None):
    """Synchronous bridge to the learning pipeline.

    Returns the dict of override fields sent back by the tutor, or ``None`` when
    the tutor is unreachable / returned nothing to override.  ``decision`` is
    mutated in place exactly as the original inline block did.  Any network
    error is swallowed.
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
        if verif_res.get("override_action"):
            decision["action"] = verif_res.get("override_action")
            decision["target_text"] = verif_res.get("override_target", decision.get("target_text"))
            decision["value"] = verif_res.get("override_value", decision.get("value"))
            if log:
                log(f"[Verification Override] step {step}: action={decision['action']} target={decision['target_text']}")
            return verif_res
    except Exception:
        pass
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
