"""
persona_graph_memory.py — graph-structured memory of REAL, human-provided
survey answers, for cross-survey consistency.

This replaces persona_memory.py's flat dict of pre-seeded traits with a
small SQLite graph (nodes + edges) that only ever stores facts that were
actually given as real answers during a session - never fabricated
qualification claims. The model's role is to help PICK a consistent
option on a later survey by looking up what was genuinely answered
before for that topic, not to invent an answer to pass a screening
question. See project decision 2026-07-27: the model's job is choosing
among options based on recorded real answers, not fabricating them.

Graph shape:
    (persona)-[:HAS_FACT]->(fact)-[:RECORDED_IN]->(survey)

Nodes:
    persona  id="persona:<key>"            label=<key>
    fact     id="fact:<persona>:<topic>"   label=<value>   (topic e.g. "bank", "car")
    survey   id="survey:<host>:<ts>"       label=<url>

A `fact` node's row also carries the topic/value directly for simple
lookups, in addition to being reachable via edges for full-graph queries
(e.g. "every fact recorded during this specific survey run").
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from typing import Optional

DB_PATH = os.path.expanduser("~/.vydra-survey-profiles/survey_graph.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    persona TEXT,
    topic TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    src TEXT NOT NULL REFERENCES nodes(id),
    dst TEXT NOT NULL REFERENCES nodes(id),
    relation TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_persona_topic ON nodes(persona, topic);
CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst);
CREATE TABLE IF NOT EXISTS host_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    host        TEXT NOT NULL,
    persona     TEXT NOT NULL DEFAULT '*',
    pattern     TEXT NOT NULL,
    behavior    TEXT NOT NULL,
    source      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'shadow',
    confidence  REAL NOT NULL DEFAULT 0.5,
    hits        INTEGER NOT NULL DEFAULT 0,
    wins        INTEGER NOT NULL DEFAULT 0,
    losses      INTEGER NOT NULL DEFAULT 0,
    evidence    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(host, persona, pattern, source)
);
CREATE INDEX IF NOT EXISTS idx_host_rules_lookup ON host_rules(host, persona, status);

CREATE TABLE IF NOT EXISTS run_traces (
    run_id         TEXT PRIMARY KEY,
    persona        TEXT NOT NULL,
    host           TEXT NOT NULL,
    url            TEXT NOT NULL,
    started_at     TEXT NOT NULL,
    ended_at       TEXT,
    outcome        TEXT,
    outcome_reason TEXT,
    final_text     TEXT,
    steps_json     TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_traces_host ON run_traces(host, started_at);

CREATE TABLE IF NOT EXISTS rule_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id     INTEGER NOT NULL,
    actor       TEXT NOT NULL,          -- 'human' | 'agent'
    action      TEXT NOT NULL,          -- edit|promote|retire|delete|create|resolve_conflict
    before_json TEXT,
    after_json  TEXT,
    note        TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rule_audit_rule_id ON rule_audit(rule_id);

CREATE TABLE IF NOT EXISTS host_gates (
    host          TEXT PRIMARY KEY,
    playbook_mode TEXT NOT NULL DEFAULT 'shadow'
                  CHECK(playbook_mode IN ('off', 'shadow', 'active')),
    updated_at    TEXT,
    updated_by    TEXT
);

CREATE TABLE IF NOT EXISTS providers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    url_pattern TEXT,
    note        TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hosts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname    TEXT NOT NULL UNIQUE,
    label       TEXT,
    provider_id INTEGER REFERENCES providers(id),
    note        TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'direct_cdp' CHECK(kind IN ('direct_cdp','mcp_bridge')),
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL,
    mcp_server  TEXT,
    note        TEXT,
    is_active   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    content_md  TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patterns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    key                 TEXT NOT NULL UNIQUE,
    label               TEXT,
    keywords            TEXT NOT NULL DEFAULT '[]',
    qualifying_polarity TEXT,
    is_builtin          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key                 TEXT PRIMARY KEY,
    value               TEXT,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_applications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id     INTEGER NOT NULL REFERENCES host_rules(id) ON DELETE CASCADE,
    run_id      TEXT NOT NULL,
    outcome     TEXT NOT NULL,
    applied_at  TEXT NOT NULL,
    UNIQUE(rule_id, run_id)
);
CREATE INDEX IF NOT EXISTS idx_rule_apps_rule_run ON rule_applications(rule_id, run_id);

CREATE TABLE IF NOT EXISTS async_review_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL UNIQUE,
    host            TEXT NOT NULL,
    persona         TEXT NOT NULL,
    outcome         TEXT NOT NULL,
    reason          TEXT,
    triage_category TEXT DEFAULT 'pending'
                    CHECK(triage_category IN ('pending', 'text_normalization_mismatch', 'dom_structure_change', 'navigation_timeout', 'unclassified')),
    triage_notes    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'in_review', 'resolved', 'ignored')),
    created_at      TEXT NOT NULL,
    reviewed_at     TEXT,
    reviewer_note   TEXT
);
CREATE INDEX IF NOT EXISTS idx_async_queue_status ON async_review_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_async_queue_triage ON async_review_queue(triage_category);
"""

# Phase U3 (plan-ui-astryx-addendum.md): valid host_rules.status values for the
# human-edit write path. Kept as one constant so update_host_rule/create_manual_rule/
# bulk_set_status validate identically.
_ALLOWED_STATUS = {"shadow", "active", "retired"}

# Phase U4: valid host_gates.playbook_mode values, mirrors the CHECK constraint
# in SCHEMA so Python raises the same error before hitting sqlite3.IntegrityError.
_ALLOWED_PLAYBOOK_MODES = {"off", "shadow", "active"}


def _connect() -> sqlite3.Connection:
    """Open the graph DB. Phase U4 (defect #3, plan-ui-astryx-addendum.md §2.2):
    survey_agent.py runs can write while rules_api.py reads concurrently, so
    every connection gets WAL journal mode (readers don't block the writer)
    and a busy_timeout (retry instead of immediate 'database is locked')."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.executescript(SCHEMA)
    try:
        conn.execute("ALTER TABLE run_traces ADD COLUMN rules_used TEXT DEFAULT '[]'")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE host_rules ADD COLUMN provider_id INTEGER REFERENCES providers(id)")
    except sqlite3.OperationalError:
        pass
    return conn


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _upsert_node(conn, node_id: str, node_type: str, label: str,
                  persona: Optional[str] = None, topic: Optional[str] = None) -> None:
    conn.execute(
        "INSERT INTO nodes (id, type, label, persona, topic, created_at) VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET label=excluded.label",
        (node_id, node_type, label, persona, topic, _now()),
    )


def _add_edge(conn, src: str, dst: str, relation: str) -> None:
    conn.execute(
        "INSERT INTO edges (src, dst, relation, created_at) VALUES (?, ?, ?, ?)",
        (src, dst, relation, _now()),
    )


def record_fact(persona_key: str, topic: str, value: str, survey_url: str = "") -> None:
    """Record a REAL answer as a durable fact for this persona (e.g.
    topic="bank", value="UBS"). Overwrites any prior value for the same
    (persona, topic) - the graph keeps only the current fact per topic,
    plus (via edges) which survey most recently confirmed it, not a full
    edit history; `history()` below covers the append-only run log."""
    conn = _connect()
    try:
        persona_id = f"persona:{persona_key}"
        fact_id = f"fact:{persona_key}:{topic}"
        _upsert_node(conn, persona_id, "persona", persona_key)
        _upsert_node(conn, fact_id, "fact", value, persona=persona_key, topic=topic)
        _add_edge(conn, persona_id, fact_id, "HAS_FACT")
        if survey_url:
            host = survey_url.split("//", 1)[-1].split("/", 1)[0]
            survey_id = f"survey:{host}:{_now()}"
            _upsert_node(conn, survey_id, "survey", survey_url)
            _add_edge(conn, fact_id, survey_id, "RECORDED_IN")
        conn.commit()
    finally:
        conn.close()


def get_facts(persona_key: str) -> dict[str, str]:
    """Current known real facts for a persona, keyed by topic - the most
    recently recorded value per topic wins (nodes are upserted, not
    duplicated per fact, so this is just a direct read)."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT topic, label FROM nodes WHERE type='fact' AND persona=?",
            (persona_key,),
        ).fetchall()
        return {topic: label for topic, label in rows}
    finally:
        conn.close()


def get_fact_history(persona_key: str, topic: str) -> list[dict]:
    """Every survey where this (persona, topic) fact was confirmed, oldest
    first - lets you see whether an answer has ever drifted."""
    conn = _connect()
    try:
        fact_id = f"fact:{persona_key}:{topic}"
        rows = conn.execute(
            "SELECT n.label, e.created_at FROM edges e "
            "JOIN nodes n ON n.id = e.dst "
            "WHERE e.src = ? AND e.relation = 'RECORDED_IN' "
            "ORDER BY e.created_at ASC",
            (fact_id,),
        ).fetchall()
        return [{"survey_url": label, "recorded_at": ts} for label, ts in rows]
    finally:
        conn.close()


def norm_host(url_or_host: str) -> str:
    """'https://survey.meinungsplatz.ch/foo?x=1' -> 'survey.meinungsplatz.ch'."""
    if not url_or_host:
        return "*"
    host = url_or_host.split("//", 1)[-1].split("/", 1)[0]
    host = host.split(":", 1)[0]
    return host or "*"


def base_domain(host: str) -> str:
    """'survey.meinungsplatz.ch' -> 'meinungsplatz.ch' (last 2 segments)."""
    if not host or host == "*":
        return host
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def record_host_rule(host: str, pattern: str, behavior: str, *,
                      persona: str = "*", source: str,
                      status: str = "shadow", confidence: float = 0.5,
                      evidence: Optional[dict] = None) -> int:
    """UPSERT a host_rule by (host, persona, pattern, source)."""
    conn = _connect()
    try:
        now = _now()
        ev = json.dumps(evidence) if evidence is not None else None
        conn.execute(
            "INSERT INTO host_rules (host, persona, pattern, behavior, source, status, "
            "confidence, evidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(host, persona, pattern, source) DO UPDATE SET "
            "behavior=excluded.behavior, "
            "confidence=MIN(0.95, host_rules.confidence + 0.15), "
            "evidence=excluded.evidence, "
            "updated_at=excluded.updated_at",
            (host, persona, pattern, behavior, source, status, confidence, ev, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id FROM host_rules WHERE host=? AND persona=? AND pattern=? AND source=?",
            (host, persona, pattern, source),
        ).fetchone()
        return row[0]
    finally:
        conn.close()


def get_host_rules(
    host: str, 
    persona: str = "", 
    include_shadow: bool = False,
    active_run_id: str = ""
) -> list[dict]:
    """Fetch host rules with exact priority score:
    exact host (4) > base domain (3) > provider_id (2) > wildcard * (1).
    Deduplicates per pattern so highest priority rule wins.
    Fully parameterized query preventing SQL injection."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        norm = norm_host(host)
        base = base_domain(norm)
        provider_id = None
        
        p_row = conn.execute(
            "SELECT provider_id FROM hosts WHERE hostname = ? OR hostname = ?", 
            (norm, base)
        ).fetchone()
        if p_row and p_row["provider_id"]:
            provider_id = p_row["provider_id"]

        params = [norm, base, provider_id, persona, norm, base, provider_id, persona]

        if include_shadow:
            status_clause = "status IN ('active', 'shadow')"
        elif active_run_id:
            status_clause = "(status = 'active' OR (status = 'shadow' AND json_extract(evidence, '$.run_id') = ?))"
            params.append(active_run_id)
        else:
            status_clause = "status = 'active'"

        sql = f"""
            SELECT *,
                (CASE 
                    WHEN host = ? THEN 4
                    WHEN host = ? THEN 3
                    WHEN (provider_id IS NOT NULL AND provider_id = ?) THEN 2
                    WHEN host = '*' THEN 1
                    ELSE 0
                 END) AS host_score,
                (CASE 
                    WHEN persona = ? THEN 2
                    ELSE 1
                 END) AS persona_score
            FROM host_rules
            WHERE (host = ? OR host = ? OR (provider_id IS NOT NULL AND provider_id = ?) OR host = '*')
              AND (persona = ? OR persona = '*' OR persona = '' OR persona IS NULL)
              AND {status_clause}
            ORDER BY host_score DESC, persona_score DESC, confidence DESC, id ASC
        """
        rows = conn.execute(sql, params).fetchall()

        seen_patterns = set()
        winning_rules = []
        for r in rows:
            rule_dict = dict(r)
            pat = rule_dict["pattern"]
            if pat not in seen_patterns:
                seen_patterns.add(pat)
                winning_rules.append(rule_dict)

        return winning_rules
    finally:
        conn.close()


def bump_rule_outcome(rule_ids: list[int], outcome: str, run_id: str = "") -> None:
    """Increment wins/losses for `rule_ids` based on `outcome`, record entry in
    rule_applications, then promote shadow rules or retire consistently-losing ones.
    Ignores UNKNOWN outcomes to prevent skewing stats."""
    if not rule_ids or not outcome or outcome.upper() == "UNKNOWN":
        return
    conn = _connect()
    try:
        now_str = _now()
        is_win = (outcome.lower() == "completed")
        field = "wins" if is_win else "losses"
        
        for rid in rule_ids:
            conn.execute(
                f"UPDATE host_rules SET {field} = {field} + 1, updated_at = ? WHERE id = ?",
                (now_str, rid)
            )
            if run_id:
                conn.execute(
                    "INSERT OR IGNORE INTO rule_applications (rule_id, run_id, outcome, applied_at) VALUES (?, ?, ?, ?)",
                    (rid, run_id, outcome.lower(), now_str)
                )
            row = conn.execute(
                "SELECT wins, losses FROM host_rules WHERE id=?", (rid,)
            ).fetchone()
            if row is None:
                continue
            wins, losses = row
            if losses >= 3 and losses > wins:
                conn.execute("UPDATE host_rules SET status='retired', updated_at=? WHERE id=?",
                             (now_str, rid))
        conn.commit()
    finally:
        conn.close()

    # Trigger strict N>=3 unique run_id auto-promotion
    auto_promote_rules(min_unique_runs=3)


def auto_promote_rules(min_unique_runs: int = 3) -> int:
    """Promotes shadow rules to active ONLY if they are confirmed across
    at least min_unique_runs distinct completed runs in rule_applications."""
    conn = _connect()
    try:
        now_str = _now()
        cur = conn.execute(
            """
            UPDATE host_rules 
            SET status = 'active', updated_at = ? 
            WHERE status = 'shadow' 
              AND wins >= ? 
              AND wins > (losses * 2)
              AND (
                  SELECT COUNT(DISTINCT run_id)
                  FROM rule_applications
                  WHERE rule_applications.rule_id = host_rules.id
                    AND LOWER(outcome) = 'completed'
              ) >= ?
            """,
            (now_str, min_unique_runs, min_unique_runs)
        )
        promoted_count = cur.rowcount
        conn.commit()
        return promoted_count
    finally:
        conn.close()


def start_run_trace(persona: str, url: str) -> str:
    """Create a new run_traces row, return its run_id."""
    run_id = f"{persona}:{norm_host(url)}:{_now()}"
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO run_traces (run_id, persona, host, url, started_at, steps_json) "
            "VALUES (?, ?, ?, ?, ?, '[]')",
            (run_id, persona, norm_host(url), url, _now()),
        )
        conn.commit()
        return run_id
    finally:
        conn.close()


def record_run_trace(run_id: str, *, outcome: str, outcome_reason: str,
                      final_text: str, steps: list[dict],
                      rules_used: Optional[list[int]] = None) -> None:
    """Finalize a run_traces row, enqueue into async_review_queue if failed,
    then prune old traces beyond 40 per host."""
    conn = _connect()
    try:
        rules_used_str = json.dumps(rules_used or [])
        try:
            conn.execute(
                "UPDATE run_traces SET outcome=?, outcome_reason=?, final_text=?, "
                "steps_json=?, rules_used=?, ended_at=? WHERE run_id=?",
                (outcome, outcome_reason, (final_text or "")[:2000],
                 json.dumps(steps), rules_used_str, _now(), run_id),
            )
        except sqlite3.OperationalError:
            conn.execute(
                "UPDATE run_traces SET outcome=?, outcome_reason=?, final_text=?, "
                "steps_json=?, ended_at=? WHERE run_id=?",
                (outcome, outcome_reason, (final_text or "")[:2000],
                 json.dumps(steps), _now(), run_id),
            )
        conn.commit()
        row = conn.execute("SELECT host, persona FROM run_traces WHERE run_id=?", (run_id,)).fetchone()
        if row is not None:
            host, persona = row[0], row[1]
            
            # Enqueue failed run into async_review_queue
            if outcome and outcome.lower() != "completed":
                conn.execute(
                    """
                    INSERT INTO async_review_queue (run_id, host, persona, outcome, reason, triage_category, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?)
                    ON CONFLICT(run_id) DO UPDATE SET
                        outcome=excluded.outcome,
                        reason=excluded.reason
                    """,
                    (run_id, host, persona, outcome, outcome_reason or "", _now())
                )
                conn.commit()

            conn.execute(
                "DELETE FROM run_traces WHERE host=? AND run_id NOT IN ("
                "  SELECT run_id FROM run_traces WHERE host=? ORDER BY started_at DESC LIMIT 40"
                ")",
                (host, host),
            )
            conn.commit()
    finally:
        conn.close()


def list_rules_raw(
    host: Optional[str | list[str]] = None,
    persona: Optional[str | list[str]] = None,
    status: Optional[str | list[str]] = None,
    source: Optional[str | list[str]] = None,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
) -> list[dict]:
    """Raw query on host_rules table without deduplication or precedence sorting."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        query = "SELECT * FROM host_rules WHERE 1=1"
        params: list = []

        def add_filter(col: str, val):
            nonlocal query
            if val is None:
                return
            if isinstance(val, str):
                vals = [v.strip() for v in val.split(",") if v.strip()] if "," in val else [val]
            elif isinstance(val, (list, tuple, set)):
                vals = [str(v) for v in val if v is not None]
            else:
                vals = [str(val)]
            if not vals:
                return
            placeholders = ",".join("?" for _ in vals)
            query += f" AND {col} IN ({placeholders})"
            params.extend(vals)

        add_filter("host", host)
        add_filter("persona", persona)
        add_filter("status", status)
        add_filter("source", source)

        if q:
            query += " AND (pattern LIKE ? OR behavior LIKE ?)"
            pattern_q = f"%{q}%"
            params.extend([pattern_q, pattern_q])

        allowed_sorts = {"confidence", "updated_at", "wins", "created_at", "id", "hits", "losses"}
        sort_col = sort if sort in allowed_sorts else "id"
        sort_order = "ASC" if order and str(order).lower() == "asc" else "DESC"

        query += f" ORDER BY {sort_col} {sort_order}"

        if limit is not None and limit > 0:
            query += " LIMIT ?"
            params.append(limit)
            if offset is not None and offset >= 0:
                query += " OFFSET ?"
                params.append(offset)

        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get("evidence"):
                try:
                    d["evidence"] = json.loads(d["evidence"])
                except Exception:
                    pass
            result.append(d)
        return result
    finally:
        conn.close()


def list_traces(
    host: Optional[str | list[str]] = None,
    persona: Optional[str | list[str]] = None,
    outcome: Optional[str | list[str]] = None,
    limit: Optional[int] = 50,
    offset: Optional[int] = 0,
) -> list[dict]:
    """Query run_traces log table with basic filters."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        query = "SELECT * FROM run_traces WHERE 1=1"
        params: list = []

        def add_filter(col: str, val):
            nonlocal query
            if val is None:
                return
            if isinstance(val, str):
                vals = [v.strip() for v in val.split(",") if v.strip()] if "," in val else [val]
            elif isinstance(val, (list, tuple, set)):
                vals = [str(v) for v in val if v is not None]
            else:
                vals = [str(val)]
            if not vals:
                return
            placeholders = ",".join("?" for _ in vals)
            query += f" AND {col} IN ({placeholders})"
            params.extend(vals)

        add_filter("host", host)
        add_filter("persona", persona)
        add_filter("outcome", outcome)

        query += " ORDER BY started_at DESC"

        if limit is not None and limit > 0:
            query += " LIMIT ?"
            params.append(limit)
            if offset is not None and offset >= 0:
                query += " OFFSET ?"
                params.append(offset)

        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get("steps_json"):
                try:
                    d["steps_json"] = json.loads(d["steps_json"])
                except Exception:
                    pass
            if d.get("rules_used"):
                try:
                    d["rules_used"] = json.loads(d["rules_used"])
                except Exception:
                    d["rules_used"] = []
            else:
                d["rules_used"] = []
            result.append(d)
        return result
    finally:
        conn.close()


def get_trace(run_id: str) -> Optional[dict]:
    """Fetch a single run_traces row by run_id with parsed steps_json and rules_used."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM run_traces WHERE run_id=?", (run_id,)).fetchone()
        if row is None:
            return None
        d = dict(row)
        if d.get("steps_json"):
            try:
                d["steps_json"] = json.loads(d["steps_json"])
            except Exception:
                pass
        if d.get("rules_used"):
            try:
                d["rules_used"] = json.loads(d["rules_used"])
            except Exception:
                d["rules_used"] = []
        else:
            d["rules_used"] = []
        return d
    finally:
        conn.close()


def record_rule_audit(rule_id: int, action: str, before: Optional[dict], after: Optional[dict],
                       actor: str, note: Optional[str] = None,
                       conn: Optional[sqlite3.Connection] = None) -> None:
    """Append one row to rule_audit. Pass an open `conn` to fold this into a
    caller's transaction (bulk ops); otherwise opens+commits+closes its own."""
    own = conn is None
    if own:
        conn = _connect()
    try:
        conn.execute(
            "INSERT INTO rule_audit (rule_id, actor, action, before_json, after_json, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (rule_id, actor, action,
             json.dumps(before) if before is not None else None,
             json.dumps(after) if after is not None else None,
             note, _now()),
        )
        if own:
            conn.commit()
    finally:
        if own:
            conn.close()


def update_host_rule(rule_id: int, *, behavior: Optional[str] = None,
                      confidence: Optional[float] = None, status: Optional[str] = None,
                      actor: str = "human", note: Optional[str] = None,
                      audit_action: str = "edit") -> dict:
    """Write exactly the given fields to an existing host_rules row (+ updated_at).

    Unlike record_host_rule(), this NEVER bumps confidence - it is the write
    path for human edits (defect #1, plan-ui-astryx-addendum.md §0). Records a
    rule_audit row with the before/after state. Raises LookupError if rule_id
    does not exist, ValueError on invalid status/confidence/behavior."""
    if status is not None and status not in _ALLOWED_STATUS:
        raise ValueError(f"status must be one of {sorted(_ALLOWED_STATUS)}, got {status!r}")
    if behavior is not None:
        behavior = behavior.strip()
        if not behavior:
            raise ValueError("behavior cannot be empty")
        if len(behavior) > 2000:
            raise ValueError("behavior must be <= 2000 chars")
    if confidence is not None:
        confidence = max(0.0, min(1.0, float(confidence)))

    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        before_row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rule_id,)).fetchone()
        if before_row is None:
            raise LookupError(f"host_rules row {rule_id} not found")
        before = dict(before_row)

        sets, params = [], []
        if behavior is not None:
            sets.append("behavior=?")
            params.append(behavior)
        if confidence is not None:
            sets.append("confidence=?")
            params.append(confidence)
        if status is not None:
            sets.append("status=?")
            params.append(status)
        if not sets:
            return before

        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(rule_id)
        conn.execute(f"UPDATE host_rules SET {', '.join(sets)} WHERE id=?", params)

        after = dict(conn.execute("SELECT * FROM host_rules WHERE id=?", (rule_id,)).fetchone())
        record_rule_audit(rule_id, audit_action, before, after, actor, note, conn=conn)
        conn.commit()
        return after
    finally:
        conn.close()


def create_manual_rule(host: str, pattern: str, behavior: str, *, persona: str = "*",
                        confidence: float = 0.7, status: str = "active",
                        actor: str = "human", note: Optional[str] = None) -> int:
    """Create a new host_rules row directly, source='human_override' always.

    Unlike record_host_rule(), raises ValueError if a row already exists for
    (host, persona, pattern, source='human_override') instead of silently
    bumping its confidence (defect #1) - use update_host_rule() to edit an
    existing row. Returns the new row id."""
    if status not in _ALLOWED_STATUS:
        raise ValueError(f"status must be one of {sorted(_ALLOWED_STATUS)}, got {status!r}")
    behavior = (behavior or "").strip()
    if not behavior:
        raise ValueError("behavior cannot be empty")
    if len(behavior) > 2000:
        raise ValueError("behavior must be <= 2000 chars")
    if not pattern:
        raise ValueError("pattern cannot be empty")
    confidence = max(0.0, min(1.0, float(confidence)))

    conn = _connect()
    try:
        existing = conn.execute(
            "SELECT id FROM host_rules WHERE host=? AND persona=? AND pattern=? AND source='human_override'",
            (host, persona, pattern),
        ).fetchone()
        if existing:
            raise ValueError(
                f"host_rules row already exists for host={host!r} persona={persona!r} "
                f"pattern={pattern!r} source='human_override' (id={existing[0]}); "
                f"use update_host_rule() instead"
            )
        now = _now()
        cur = conn.execute(
            "INSERT INTO host_rules (host, persona, pattern, behavior, source, status, "
            "confidence, evidence, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'human_override', ?, ?, ?, ?, ?)",
            (host, persona, pattern, behavior, status, confidence,
             json.dumps({"created_by": actor}), now, now),
        )
        rule_id = cur.lastrowid
        record_rule_audit(rule_id, "create", None, {
            "host": host, "persona": persona, "pattern": pattern, "behavior": behavior,
            "status": status, "confidence": confidence,
        }, actor, note, conn=conn)
        conn.commit()
        return rule_id
    finally:
        conn.close()


def bulk_set_status(rule_ids: list[int], status: str, *, actor: str = "human",
                     note: Optional[str] = None, audit_action: Optional[str] = None) -> int:
    """Set status on multiple host_rules rows in one transaction (bulk
    promote/retire from the UI). Unknown ids are skipped, not an error.
    Returns the number of rows actually changed."""
    if status not in _ALLOWED_STATUS:
        raise ValueError(f"status must be one of {sorted(_ALLOWED_STATUS)}, got {status!r}")
    action = audit_action or {"active": "promote", "retired": "retire",
                               "shadow": "revert_to_shadow"}[status]
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        changed = 0
        for rid in rule_ids:
            before_row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rid,)).fetchone()
            if before_row is None:
                continue
            before = dict(before_row)
            conn.execute("UPDATE host_rules SET status=?, updated_at=? WHERE id=?", (status, now, rid))
            after = dict(conn.execute("SELECT * FROM host_rules WHERE id=?", (rid,)).fetchone())
            record_rule_audit(rid, action, before, after, actor, note, conn=conn)
            changed += 1
        conn.commit()
        return changed
    finally:
        conn.close()


def delete_host_rule(rule_id: int, *, actor: str = "human", note: Optional[str] = None) -> bool:
    """Hard-delete one host_rules row. Records the full row in rule_audit.before_json
    first, so a delete can be manually reversed by reading the audit log. Returns
    False if the id did not exist."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        before_row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rule_id,)).fetchone()
        if before_row is None:
            return False
        record_rule_audit(rule_id, "delete", dict(before_row), None, actor, note, conn=conn)
        conn.execute("DELETE FROM host_rules WHERE id=?", (rule_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def bulk_delete_rules(rule_ids: list[int], *, actor: str = "human",
                       note: Optional[str] = None, audit_action: str = "delete") -> int:
    """Hard-delete multiple host_rules rows in one transaction. Unknown ids are
    skipped. Returns the number of rows actually deleted."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        deleted = 0
        for rid in rule_ids:
            before_row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rid,)).fetchone()
            if before_row is None:
                continue
            record_rule_audit(rid, audit_action, dict(before_row), None, actor, note, conn=conn)
            conn.execute("DELETE FROM host_rules WHERE id=?", (rid,))
            deleted += 1
        conn.commit()
        return deleted
    finally:
        conn.close()


def get_host_gate(host: str) -> Optional[dict]:
    """Current host_gates row for `host` (exact match, no host/base_domain/*
    fallback chain - callers that need that do it themselves, see
    get_enhanced_persona). None if the host has never been gated."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM host_gates WHERE host=?", (host,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def set_host_gate(host: str, playbook_mode: str, *, actor: str = "human",
                   note: Optional[str] = None) -> dict:
    """UPSERT host_gates.playbook_mode for `host` (phase U4 write path for
    POST /api/gate/<host>/approve). Raises ValueError on an invalid mode -
    mirrors the SCHEMA CHECK constraint so callers get a clean 400 instead of
    sqlite3.IntegrityError."""
    if playbook_mode not in _ALLOWED_PLAYBOOK_MODES:
        raise ValueError(
            f"playbook_mode must be one of {sorted(_ALLOWED_PLAYBOOK_MODES)}, got {playbook_mode!r}"
        )
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute(
            "INSERT INTO host_gates (host, playbook_mode, updated_at, updated_by) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(host) DO UPDATE SET playbook_mode=excluded.playbook_mode, "
            "updated_at=excluded.updated_at, updated_by=excluded.updated_by",
            (host, playbook_mode, now, actor),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM host_gates WHERE host=?", (host,)).fetchone()
        result = dict(row)
        record_rule_audit(0, "gate_switch", None, result, actor, note, conn=conn)
        conn.commit()
        return result
    finally:
        conn.close()


def get_enhanced_persona(profile_key: str, base_persona: str, survey_url: str = "") -> tuple[str, list[int]]:
    """Appends known REAL facts to the base persona text, for the model to
    reuse when a later survey asks about the same topic - a consistency
    aid, not a source of fabricated qualifying answers. If nothing has
    been recorded yet for this persona, returns base_persona unchanged.

    survey_url: used to look up host_rules for this host. The rules section is
    always computed when rules exist, but is only appended to the returned
    text when the host is gated 'active' - otherwise its presence is only
    logged (sha256 + length) so this stays verifiable against the shadow log.

    Phase U4 (plan-ui-astryx-addendum.md §2.3): host_gates is now the source
    of truth for per-host mode (checked host -> base_domain(host) -> '*',
    same precedence chain as get_host_rules). VYDRA_PLAYBOOK[_HOSTS] env vars
    are only consulted when no host_gates row exists at any of those levels -
    they're the old global switch, kept as a fallback for hosts nobody has
    gated yet, not an override of an explicit host_gates decision."""
    used_rule_ids: list[int] = []
    facts = get_facts(profile_key)
    result = base_persona if not facts else None

    if facts:
        section = (
            "\n\n---\n"
            "## 🧠 РАНІШЕ ЗАФІКСОВАНІ РЕАЛЬНІ ВІДПОВІДІ\n\n"
            "Якщо питання стосується однієї з цих тем — обери варіант, що відповідає "
            "вже зафіксованій реальній відповіді нижче, для консистентності між опитуваннями. "
            "Якщо теми немає в списку — відповідай на власний розсуд, нічого не вигадуй "
            "спеціально для проходження скринінгу.\n\n"
        )
        for topic, value in sorted(facts.items()):
            section += f"   * **{topic}**: {value}\n"
        result = base_persona + section

    if survey_url:
        host = norm_host(survey_url)
        rules = get_host_rules(host, profile_key, include_shadow=False)
        if rules:
            rules = sorted(rules, key=lambda r: -r["confidence"])[:12]
            rules_section = "\n\n---\n## 📋 ПРАВИЛА ЦЬОГО СЕРВІСУ\n\n"
            candidate_ids = []
            for r in rules:
                suffix = " (людина)" if r["source"] == "human_override" else ""
                line = f"   * {r['behavior']}{suffix}\n"
                if len(rules_section) + len(line) > 1500:
                    break
                rules_section += line
                candidate_ids.append(r["id"])

            gate_active = None
            for lvl in (host, base_domain(host), "*"):
                gate = get_host_gate(lvl)
                if gate is not None:
                    gate_active = gate["playbook_mode"] == "active"
                    break
            if gate_active is None:
                gate_active = (os.environ.get("VYDRA_PLAYBOOK") == "active"
                                and (not os.environ.get("VYDRA_PLAYBOOK_HOSTS")
                                     or host in {norm_host(h) for h in os.environ["VYDRA_PLAYBOOK_HOSTS"].split(",")}))

            if gate_active:
                result = (result if result is not None else base_persona) + rules_section
                used_rule_ids = candidate_ids
            else:
                print(f"[shadow] would-add host_rules section for {host}: "
                      f"sha256={hashlib.sha256(rules_section.encode()).hexdigest()[:12]} "
                      f"({len(rules_section)} chars)", flush=True)

    return (result if result is not None else base_persona), used_rule_ids


def record_survey_outcome(profile_key: str, survey_url: str, status: str,
                           payout: str = "", learned_facts: Optional[dict] = None,
                           reason: str = "", run_id: str = "") -> None:
    """History log entry for a completed/dry-run/disqualified survey pass -
    kept as a lightweight node+edge too, so it shows up in the same graph
    rather than a second parallel storage format. `learned_facts`, if given,
    is recorded via record_fact() per (topic, value) pair for consistency
    with later surveys. `reason`/`run_id` are accepted for forward
    compatibility with run_traces but not yet persisted here."""
    conn = _connect()
    try:
        persona_id = f"persona:{profile_key}"
        host = survey_url.split("//", 1)[-1].split("/", 1)[0] if survey_url else "unknown"
        node_run_id = f"run:{profile_key}:{host}:{_now()}"
        _upsert_node(conn, persona_id, "persona", profile_key)
        _upsert_node(conn, node_run_id, "run", f"{status} {payout}".strip())
        _add_edge(conn, persona_id, node_run_id, "RAN")
        conn.commit()
        print(f"[graph_memory] Recorded run for profile={profile_key}: status={status} payout={payout}", flush=True)
    finally:
        conn.close()
    if learned_facts:
        for k, v in learned_facts.items():
            record_fact(profile_key, k, v, survey_url)


# --- CRUD helpers for providers, hosts, personas, patterns ---

def list_providers() -> list[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM providers ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_provider(key: str, label: str, url_pattern: Optional[str] = None, note: Optional[str] = None) -> dict:
    if not key or not str(key).strip():
        raise ValueError("key cannot be empty")
    if not label or not str(label).strip():
        raise ValueError("label cannot be empty")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute(
            "INSERT INTO providers (key, label, url_pattern, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (key.strip(), label.strip(), url_pattern, note, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM providers WHERE key=?", (key.strip(),)).fetchone()
        return dict(row)
    finally:
        conn.close()


def update_provider(id: int, **fields) -> dict:
    allowed = {"key", "label", "url_pattern", "note"}
    invalid = set(fields.keys()) - allowed
    if invalid:
        raise ValueError(f"Invalid fields for provider update: {sorted(invalid)}")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT * FROM providers WHERE id=?", (id,)).fetchone()
        if existing is None:
            raise LookupError(f"provider id={id} not found")
        if not fields:
            return dict(existing)
        sets, params = [], []
        for k, v in fields.items():
            sets.append(f"{k}=?")
            params.append(v)
        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(id)
        conn.execute(f"UPDATE providers SET {', '.join(sets)} WHERE id=?", params)
        conn.commit()
        row = conn.execute("SELECT * FROM providers WHERE id=?", (id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def delete_provider(id: int) -> bool:
    conn = _connect()
    try:
        existing = conn.execute("SELECT id FROM providers WHERE id=?", (id,)).fetchone()
        if existing is None:
            return False
        conn.execute("DELETE FROM providers WHERE id=?", (id,))
        conn.commit()
        return True
    finally:
        conn.close()


def list_hosts() -> list[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM hosts ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_host(hostname: str, label: str = "", provider_id: Optional[int] = None, note: Optional[str] = None) -> dict:
    if not hostname or not str(hostname).strip():
        raise ValueError("hostname cannot be empty")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute(
            "INSERT INTO hosts (hostname, label, provider_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (hostname.strip(), label, provider_id, note, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM hosts WHERE hostname=?", (hostname.strip(),)).fetchone()
        return dict(row)
    finally:
        conn.close()


def update_host(id: int, **fields) -> dict:
    allowed = {"hostname", "label", "provider_id", "note"}
    invalid = set(fields.keys()) - allowed
    if invalid:
        raise ValueError(f"Invalid fields for host update: {sorted(invalid)}")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT * FROM hosts WHERE id=?", (id,)).fetchone()
        if existing is None:
            raise LookupError(f"host id={id} not found")
        if not fields:
            return dict(existing)
        sets, params = [], []
        for k, v in fields.items():
            sets.append(f"{k}=?")
            params.append(v)
        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(id)
        conn.execute(f"UPDATE hosts SET {', '.join(sets)} WHERE id=?", params)
        conn.commit()
        row = conn.execute("SELECT * FROM hosts WHERE id=?", (id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def delete_host(id: int) -> bool:
    conn = _connect()
    try:
        existing = conn.execute("SELECT id FROM hosts WHERE id=?", (id,)).fetchone()
        if existing is None:
            return False
        conn.execute("DELETE FROM hosts WHERE id=?", (id,))
        conn.commit()
        return True
    finally:
        conn.close()


def list_browser_sources() -> list[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM browser_sources ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_browser_source(
    key: str,
    label: str,
    kind: str = "direct_cdp",
    host: str = "",
    port: int = 0,
    mcp_server: Optional[str] = None,
    note: Optional[str] = None,
) -> dict:
    if not key or not str(key).strip():
        raise ValueError("key cannot be empty")
    if not label or not str(label).strip():
        raise ValueError("label cannot be empty")
    if not host or not str(host).strip():
        raise ValueError("host cannot be empty")
    if kind not in ("direct_cdp", "mcp_bridge"):
        raise ValueError("kind must be direct_cdp or mcp_bridge")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute(
            "INSERT INTO browser_sources (key, label, kind, host, port, mcp_server, note, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
            (key.strip(), label.strip(), kind, host.strip(), int(port), mcp_server, note, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM browser_sources WHERE key=?", (key.strip(),)).fetchone()
        return dict(row)
    finally:
        conn.close()


def update_browser_source(id: int, **fields) -> dict:
    allowed = {"key", "label", "kind", "host", "port", "mcp_server", "note"}
    invalid = set(fields.keys()) - allowed
    if invalid:
        raise ValueError(f"Invalid fields for browser_source update: {sorted(invalid)}")
    if "key" in fields and (not fields["key"] or not str(fields["key"]).strip()):
        raise ValueError("key cannot be empty")
    if "label" in fields and (not fields["label"] or not str(fields["label"]).strip()):
        raise ValueError("label cannot be empty")
    if "host" in fields and (not fields["host"] or not str(fields["host"]).strip()):
        raise ValueError("host cannot be empty")
    if "kind" in fields and fields["kind"] not in ("direct_cdp", "mcp_bridge"):
        raise ValueError("kind must be direct_cdp or mcp_bridge")

    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT * FROM browser_sources WHERE id=?", (id,)).fetchone()
        if existing is None:
            raise LookupError(f"browser_source id={id} not found")
        if not fields:
            return dict(existing)
        sets, params = [], []
        for k, v in fields.items():
            sets.append(f"{k}=?")
            if k in ("key", "label", "host") and isinstance(v, str):
                params.append(v.strip())
            elif k == "port":
                params.append(int(v))
            else:
                params.append(v)
        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(id)
        conn.execute(f"UPDATE browser_sources SET {', '.join(sets)} WHERE id=?", params)
        conn.commit()
        row = conn.execute("SELECT * FROM browser_sources WHERE id=?", (id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def delete_browser_source(id: int) -> bool:
    conn = _connect()
    try:
        existing = conn.execute("SELECT id FROM browser_sources WHERE id=?", (id,)).fetchone()
        if existing is None:
            return False
        conn.execute("DELETE FROM browser_sources WHERE id=?", (id,))
        conn.commit()
        return True
    finally:
        conn.close()


def set_active_browser_source(id: int) -> dict:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute("UPDATE browser_sources SET is_active=0")
        existing = conn.execute("SELECT * FROM browser_sources WHERE id=?", (id,)).fetchone()
        if existing is None:
            conn.rollback()
            raise LookupError(f"browser_source id={id} not found")
        conn.execute(
            "UPDATE browser_sources SET is_active=1, updated_at=? WHERE id=?",
            (now, id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM browser_sources WHERE id=?", (id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def get_active_browser_source() -> Optional[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM browser_sources WHERE is_active=1 LIMIT 1").fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_browser_source(id: int) -> Optional[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM browser_sources WHERE id=?", (id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_browser_source_by_key(key: str) -> Optional[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM browser_sources WHERE key=?", (key.strip(),)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_personas() -> list[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM personas ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_persona(key: str) -> Optional[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM personas WHERE key=?", (key,)).fetchone()
        return dict(row) if row is not None else None
    finally:
        conn.close()


def create_persona(key: str, label: str, content_md: str = "", active: int = 1) -> dict:
    if not key or not str(key).strip():
        raise ValueError("key cannot be empty")
    if not label or not str(label).strip():
        raise ValueError("label cannot be empty")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        now = _now()
        conn.execute(
            "INSERT INTO personas (key, label, content_md, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (key.strip(), label.strip(), content_md, 1 if active else 0, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM personas WHERE key=?", (key.strip(),)).fetchone()
        return dict(row)
    finally:
        conn.close()


def update_persona(key: str, **fields) -> dict:
    allowed = {"label", "content_md", "active"}
    invalid = set(fields.keys()) - allowed
    if invalid:
        raise ValueError(f"Invalid fields for persona update: {sorted(invalid)}")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT * FROM personas WHERE key=?", (key,)).fetchone()
        if existing is None:
            raise LookupError(f"persona key={key!r} not found")
        if not fields:
            return dict(existing)
        sets, params = [], []
        for k, v in fields.items():
            if k == "active":
                v = 1 if v else 0
            sets.append(f"{k}=?")
            params.append(v)
        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(key)
        conn.execute(f"UPDATE personas SET {', '.join(sets)} WHERE key=?", params)
        conn.commit()
        row = conn.execute("SELECT * FROM personas WHERE key=?", (key,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def delete_persona(key: str) -> bool:
    conn = _connect()
    try:
        existing = conn.execute("SELECT id FROM personas WHERE key=?", (key,)).fetchone()
        if existing is None:
            return False
        conn.execute("DELETE FROM personas WHERE key=?", (key,))
        conn.commit()
        return True
    finally:
        conn.close()


def list_patterns() -> list[dict]:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM patterns ORDER BY id ASC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            kw = d.get("keywords")
            if isinstance(kw, str):
                try:
                    d["keywords"] = json.loads(kw)
                except Exception:
                    d["keywords"] = []
            elif not isinstance(kw, list):
                d["keywords"] = []
            result.append(d)
        return result
    finally:
        conn.close()


def create_pattern(key: str, label: Optional[str] = None, keywords: Optional[list[str] | str] = None, qualifying_polarity: Optional[str] = None) -> dict:
    if not key or not str(key).strip():
        raise ValueError("key cannot be empty")
    k_str = key.strip()
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT id, is_builtin FROM patterns WHERE key=?", (k_str,)).fetchone()
        if existing:
            if existing["is_builtin"] == 1:
                raise ValueError(f"Cannot recreate or overwrite builtin pattern '{k_str}'")

        if keywords is None:
            keywords_json = "[]"
        elif isinstance(keywords, list):
            keywords_json = json.dumps(keywords)
        elif isinstance(keywords, str):
            try:
                json.loads(keywords)
                keywords_json = keywords
            except Exception:
                keywords_json = json.dumps([keywords])
        else:
            keywords_json = "[]"

        now = _now()
        lbl = label if label is not None else k_str
        conn.execute(
            "INSERT INTO patterns (key, label, keywords, qualifying_polarity, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
            (k_str, lbl, keywords_json, qualifying_polarity, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM patterns WHERE key=?", (k_str,)).fetchone()
        d = dict(row)
        try:
            d["keywords"] = json.loads(d["keywords"])
        except Exception:
            d["keywords"] = []
        return d
    finally:
        conn.close()


def update_pattern(key: str, **fields) -> dict:
    allowed = {"label", "keywords", "qualifying_polarity"}
    invalid = set(fields.keys()) - allowed
    if invalid:
        raise ValueError(f"Invalid fields for pattern update: {sorted(invalid)}")
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT * FROM patterns WHERE key=?", (key,)).fetchone()
        if existing is None:
            raise LookupError(f"pattern key={key!r} not found")
        if existing["is_builtin"] == 1:
            raise ValueError(f"Cannot update builtin pattern '{key}'")
        if not fields:
            d = dict(existing)
            try:
                d["keywords"] = json.loads(d["keywords"])
            except Exception:
                d["keywords"] = []
            return d

        sets, params = [], []
        for k, v in fields.items():
            if k == "keywords":
                if isinstance(v, list):
                    v = json.dumps(v)
                elif isinstance(v, str):
                    try:
                        json.loads(v)
                    except Exception:
                        v = json.dumps([v])
            sets.append(f"{k}=?")
            params.append(v)
        now = _now()
        sets.append("updated_at=?")
        params.append(now)
        params.append(key)
        conn.execute(f"UPDATE patterns SET {', '.join(sets)} WHERE key=?", params)
        conn.commit()
        row = conn.execute("SELECT * FROM patterns WHERE key=?", (key,)).fetchone()
        d = dict(row)
        try:
            d["keywords"] = json.loads(d["keywords"])
        except Exception:
            d["keywords"] = []
        return d
    finally:
        conn.close()


def delete_pattern(key: str) -> bool:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        existing = conn.execute("SELECT id, is_builtin FROM patterns WHERE key=?", (key,)).fetchone()
        if existing is None:
            return False
        if existing["is_builtin"] == 1:
            raise ValueError(f"Cannot delete builtin pattern '{key}'")
        conn.execute("DELETE FROM patterns WHERE key=?", (key,))
        conn.commit()
        return True
    finally:
        conn.close()


def migrate_settings(
    topic_keywords: Optional[dict[str, list[str]]] = None,
    qualifying_polarity: Optional[dict[str, str]] = None,
    personas_seed: Optional[list[dict[str, str]]] = None,
) -> None:
    """One-time idempotent migration for providers, hosts, personas, and patterns tables."""
    conn = _connect()
    try:
        now = _now()
        # 1. patterns
        if topic_keywords:
            qual_pol = qualifying_polarity or {}
            for key, kws in topic_keywords.items():
                pol = qual_pol.get(key)
                kws_json = json.dumps(kws) if isinstance(kws, list) else (kws if isinstance(kws, str) else "[]")
                conn.execute(
                    "INSERT OR IGNORE INTO patterns (key, label, keywords, qualifying_polarity, is_builtin, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, ?, ?)",
                    (key, key, kws_json, pol, now, now),
                )

        # 2. hosts
        conn.execute(
            "INSERT OR IGNORE INTO hosts (hostname, label, created_at, updated_at) "
            "VALUES ('*', 'Глобальний (усі хости)', ?, ?)",
            (now, now),
        )
        existing_hosts = conn.execute(
            "SELECT DISTINCT host FROM host_rules WHERE host IS NOT NULL AND host != '*'"
        ).fetchall()
        for r in existing_hosts:
            h = r[0]
            if h:
                conn.execute(
                    "INSERT OR IGNORE INTO hosts (hostname, label, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?)",
                    (h, h, now, now),
                )

        # 3. personas
        if personas_seed:
            for p in personas_seed:
                p_key = p.get("key")
                p_label = p.get("label") or p_key
                p_content = p.get("content_md") or ""
                if p_key:
                    conn.execute(
                        "INSERT OR IGNORE INTO personas (key, label, content_md, active, created_at, updated_at) "
                        "VALUES (?, ?, ?, 1, ?, ?)",
                        (p_key, p_label, p_content, now, now),
                    )

        # 4. browser_sources
        conn.execute(
            "INSERT OR IGNORE INTO browser_sources (key, label, kind, host, port, mcp_server, note, is_active, created_at, updated_at) "
            "VALUES ('legacy_184', 'Legacy CDP (.184:9226)', 'direct_cdp', '192.168.3.184', 9226, NULL, "
            "'Попередній цільовий хост, лишений як альтернатива після консолідації на .30.', 0, ?, ?)",
            (now, now),
        )
        conn.execute(
            "INSERT OR IGNORE INTO browser_sources (key, label, kind, host, port, mcp_server, note, is_active, created_at, updated_at) "
            "VALUES ('swiss_perplexity_comet', 'Swiss Perplexity Comet (.30)', 'mcp_bridge', '192.168.3.30', 9226, "
            "'comet-win,browser-harness-win', 'SOCKS5 100.66.97.93:1080 вбудовано на рівні браузера. Доступний також через MCP-мости comet-win (8765) і browser-harness-win (8766) — обидва ведуть на той самий CDP.', 1, ?, ?)",
            (now, now),
        )

        conn.commit()
    finally:
        conn.close()


def migrate() -> None:
    """One-time (idempotent) migration: legacy rule_* facts -> host_rules,
    persona_memory.py seed facts -> record_fact(), and global qualification
    seed rules -> host_rules(host='*'). Safe to re-run: never bumps
    confidence on an already-migrated row (checks existence first), and
    never deletes the legacy fact rows it reads from."""
    import reflection

    conn = _connect()
    try:
        legacy_rows = conn.execute(
            "SELECT id, label, persona, topic FROM nodes WHERE type='fact' AND topic LIKE 'rule_%'"
        ).fetchall()
        for fact_id, label, persona, topic in legacy_rows:
            edge = conn.execute(
                "SELECT n.label FROM edges e JOIN nodes n ON n.id = e.dst "
                "WHERE e.src = ? AND e.relation = 'RECORDED_IN' ORDER BY e.created_at DESC LIMIT 1",
                (fact_id,),
            ).fetchone()
            host = norm_host(edge[0]) if edge else "*"
            pattern = reflection.detect_pattern(label)
            if pattern is None:
                pattern = f"legacy:{topic}"
            existing = conn.execute(
                "SELECT id FROM host_rules WHERE host=? AND persona=? AND pattern=? AND source='human_override'",
                (host, persona, pattern),
            ).fetchone()
            if existing:
                continue
            record_host_rule(host, pattern, label, persona=persona, source="human_override",
                              status="active", confidence=0.9, evidence={"migrated_from": topic})
    finally:
        conn.close()

    record_fact("arno", "tobacco_smoker", "True")
    record_fact("arno", "tobacco_details",
                "Курець IQOS / HEETS та сигарет Marlboro Red (~10 стіків/сигарет на день, "
                "стаж 5+ років, купує в K Kiosk та Migros). На питання скрінінгу про вживання "
                "тютюну/IQOS відповідає СТВЕРДНО.")
    record_fact("arno", "coffee_details", "П'є каву Nespresso та Migros/Coop, 2-3 чашки на день.")
    record_fact("arno", "tech_details", "Користується Tesla Model 3, iPhone 15 Pro, Revolut, UBS.")
    record_fact("annet", "coffee_details", "П'є каву Nespresso, 1-2 чашки на день.")
    record_fact("annet", "tech_details", "Користується iPhone 14, UBS, Helsana.")

    from reflection import QUALIFYING_POLARITY

    conn = _connect()
    try:
        for pattern, polarity in QUALIFYING_POLARITY.items():
            existing = conn.execute(
                "SELECT id FROM host_rules WHERE host='*' AND pattern=? AND source='seed'",
                (pattern,),
            ).fetchone()
            if existing:
                continue
            if polarity == "affirm":
                behavior = (f"На питання про '{pattern}' завжди відповідай ствердно "
                            f"('Так'/'Користуюся') — стандартне правило кваліфікації опитувань, "
                            f"підвищує шанс пройти скрінінг.")
            elif polarity == "deny":
                behavior = (f"На питання про '{pattern}' завжди відповідай заперечно "
                            f"('Ні'/'Не займаюсь') — стандартне правило кваліфікації.")
            elif polarity == "not_fully_healthy":
                behavior = ("На питання про стан здоров'я відповідай, що не повністю здоровий / "
                            "має незначні проблеми зі здоров'ям — частий критерій кваліфікації "
                            "в опитуваннях про здоров'я.")
            else:
                continue
            record_host_rule("*", pattern, behavior, persona="*", source="seed",
                              status="active", confidence=0.7, evidence={"seed": True})
    finally:
        conn.close()


TOKEN_SECRET_PATH = os.path.expanduser("~/.vydra-survey-profiles/aegis_proxy_token.secret")


def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Retrieve a raw string setting from the app_settings table."""
    conn = _connect()
    try:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    """Store or update a raw string setting in the app_settings table."""
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value, _now()),
        )
        conn.commit()
    finally:
        conn.close()


def _read_secret_token() -> Optional[str]:
    """Read the Aegis proxy secret token from file (~/.vydra-survey-profiles/aegis_proxy_token.secret)."""
    if not os.path.exists(TOKEN_SECRET_PATH):
        return None
    try:
        with open(TOKEN_SECRET_PATH, "r", encoding="utf-8") as f:
            val = f.read().strip()
            return val if val else None
    except Exception:
        return None


def _write_secret_token(token: Optional[str]) -> None:
    """Write or remove the Aegis proxy secret token file with mode 0600."""
    os.makedirs(os.path.dirname(TOKEN_SECRET_PATH), exist_ok=True)
    if token is None or token == "":
        if os.path.exists(TOKEN_SECRET_PATH):
            try:
                os.remove(TOKEN_SECRET_PATH)
            except Exception:
                pass
        return
    with open(TOKEN_SECRET_PATH, "w", encoding="utf-8") as f:
        f.write(token.strip())
    try:
        os.chmod(TOKEN_SECRET_PATH, 0o600)
    except Exception:
        pass


TRIAGE_PROMPT_TEMPLATE = """You are an automated survey failure triage classifier.
Classify the root cause into EXACTLY ONE category:
1. "text_normalization_mismatch": Accent/diacritics/case/character differences (e.g. "intensité" vs "intensite").
2. "dom_structure_change": Missing DOM element, layout changed, modal blocking page.
3. "navigation_timeout": Network disconnect, CDP timeout, proxy failure, page loading timeout.
4. "unclassified": Other or screening disqualification.

Failed Run Details:
Host: {host}
Outcome: {outcome}
Reason: {reason}
Final Page Excerpt: {final_text_excerpt}

Respond with raw JSON only: {{"category": "<one_of_4>", "explanation": "<short_sentence>"}}"""

def auto_triage_pending_queue(limit: int = 10) -> int:
    """Process pending async_review_queue items using local LLM (Qwen2.5).
    Uses TRIAGE_LLM_BASE_URL env var. If agent runs on handset/Termux while
    Ollama is hosted on Orange Pi 5, TRIAGE_LLM_BASE_URL should be set to
    http://<orange_pi_tailscale_ip>:11434/v1 instead of localhost."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT * FROM async_review_queue WHERE triage_category = 'pending' LIMIT ?", 
            (limit,)
        ).fetchall()
        
        processed = 0
        for row in rows:
            run_id = row["run_id"]
            t_row = conn.execute("SELECT final_text FROM run_traces WHERE run_id = ?", (run_id,)).fetchone()
            final_text = (t_row["final_text"] if t_row else "")[:500]

            prompt = TRIAGE_PROMPT_TEMPLATE.format(
                host=row["host"],
                outcome=row["outcome"],
                reason=row["reason"] or "",
                final_text_excerpt=final_text
            )

            category = "unclassified"
            explanation = "Auto-triage fallback"

            try:
                triage_llm_url = os.environ.get("TRIAGE_LLM_BASE_URL", "http://127.0.0.1:11434/v1") + "/chat/completions"
                req_payload = json.dumps({
                    "model": os.environ.get("TRIAGE_LLM_MODEL", "qwen2.5:3b-instruct"),
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0
                }).encode("utf-8")
                
                req = urllib.request.Request(triage_llm_url, data=req_payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    content = res_data["choices"][0]["message"]["content"]
                    parsed = json.loads(content[content.find("{"):content.rfind("}")+1])
                    category = parsed.get("category", "unclassified")
                    explanation = parsed.get("explanation", "")
            except Exception as err:
                logger.warning(f"Auto-triage LLM call skipped for run {run_id}: {err}")

            conn.execute(
                "UPDATE async_review_queue SET triage_category = ?, triage_notes = ? WHERE id = ?",
                (category, explanation, row["id"])
            )
            processed += 1
        
        conn.commit()
        return processed
    finally:
        conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:\n"
              "  persona_graph_memory.py record <persona> <topic> <value> [survey_url]\n"
              "  persona_graph_memory.py facts <persona>\n"
              "  persona_graph_memory.py history <persona> <topic>\n"
              "  persona_graph_memory.py rules <host> [persona]\n"
              "  persona_graph_memory.py migrate")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "record":
        _, _, persona, topic, value, *rest = sys.argv
        record_fact(persona, topic, value, rest[0] if rest else "")
        print(f"Recorded {persona}.{topic} = {value!r}")
    elif cmd == "facts":
        _, _, persona = sys.argv
        for topic, value in get_facts(persona).items():
            print(f"{topic}: {value}")
    elif cmd == "history":
        _, _, persona, topic = sys.argv
        for entry in get_fact_history(persona, topic):
            print(f"{entry['recorded_at']}  {entry['survey_url']}")
    elif cmd == "rules":
        _, _, host, *rest = sys.argv
        persona = rest[0] if rest else "*"
        for r in get_host_rules(host, persona, include_shadow=True):
            print(f"[{r['status']}] {r['host']}/{r['persona']} {r['pattern']} "
                  f"(src={r['source']}, conf={r['confidence']:.2f}): {r['behavior']}")
    elif cmd == "migrate":
        migrate()
        import reflection
        import survey_agent
        personas_seed = []
        for p_key, p_info in survey_agent.PROFILES.items():
            persona_file = p_info.get("persona_file", "")
            label = p_info.get("label", p_key)
            content_md = ""
            if persona_file:
                path = os.path.join(survey_agent.PROFILE_CACHE_DIR, persona_file)
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        content_md = f.read()
            if not content_md:
                content_md = f"# Persona {label}\nKey: {p_key}\n"
            personas_seed.append({
                "key": p_key,
                "label": label,
                "content_md": content_md,
            })
        migrate_settings(
            topic_keywords=reflection.TOPIC_KEYWORDS,
            qualifying_polarity=reflection.QUALIFYING_POLARITY,
            personas_seed=personas_seed,
        )
        print("Migration complete.")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
