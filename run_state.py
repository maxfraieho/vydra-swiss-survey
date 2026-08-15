"""Explicit run-state machine for the survey pipeline (SDD 022, R2).

Before this module the run status was a set of bare string literals scattered
across ``astryx_survey_server.py`` and ``survey_agent.py``.  The literals are
kept byte-identical here on purpose: the REST API and the frontend read these
values, so substituting the constants must not change a single response body.

Transition validation is intentionally **log-only**: ``check_transition`` never
raises and never blocks, it only records an unexpected transition so that a real
state machine can be enforced later once the log is clean.
"""
from __future__ import annotations

import logging

IDLE = "idle"
WAITING_AUTH = "waiting_auth"
STARTING = "starting"
RUNNING = "running"
WAITING_VERIFICATION = "waiting_verification"
PAUSED = "paused"
FINISHED = "finished"
ERROR = "error"

ALL_STATES = frozenset({
    IDLE, WAITING_AUTH, STARTING, RUNNING,
    WAITING_VERIFICATION, PAUSED, FINISHED, ERROR,
})

ALLOWED: dict[str, set[str]] = {
    IDLE:                 {WAITING_AUTH, STARTING},
    WAITING_AUTH:         {STARTING, IDLE},
    STARTING:             {RUNNING, ERROR, IDLE},
    RUNNING:              {WAITING_VERIFICATION, PAUSED, FINISHED, ERROR, IDLE},
    WAITING_VERIFICATION: {RUNNING, IDLE, ERROR},
    PAUSED:               {RUNNING, IDLE},
    FINISHED:             {IDLE, WAITING_AUTH},
    ERROR:                {IDLE, WAITING_AUTH},
}

_log = logging.getLogger(__name__)


def is_allowed(old: str | None, new: str) -> bool:
    """True when ``old -> new`` is in the declared transition table.

    A self-transition (``old == new``) and an unknown/absent ``old`` are treated
    as allowed, because both occur in the current code and neither is a defect.
    """
    if old is None or old == new:
        return True
    if old not in ALLOWED:
        return True
    return new in ALLOWED[old]


def check_transition(old: str | None, new: str, where: str = "") -> bool:
    """Log-only validation. Never raises, never blocks — returns the verdict."""
    ok = is_allowed(old, new)
    if not ok:
        _log.warning("run_state: unexpected transition %r -> %r%s",
                     old, new, f" at {where}" if where else "")
    return ok
