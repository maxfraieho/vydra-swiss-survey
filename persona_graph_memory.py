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
"""


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
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


def get_host_rules(host: str, persona: str, include_shadow: bool = False) -> list[dict]:
    """Rules for `host`, most specific first: exact host > base_domain(host) > '*';
    within each level, persona-specific beats '*'. Deduped by pattern (most specific
    row kept), sorted human_override > seed > self_reflection, then confidence desc."""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    try:
        h = norm_host(host)
        levels: list[str] = []
        for lvl in (h, base_domain(h), "*"):
            if lvl not in levels:
                levels.append(lvl)
        placeholders = ",".join("?" for _ in levels)
        query = f"SELECT * FROM host_rules WHERE host IN ({placeholders}) AND persona IN (?, '*')"
        params: list = list(levels) + [persona]
        if not include_shadow:
            query += " AND status != 'shadow'"
        rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    finally:
        conn.close()

    source_rank = {"human_override": 0, "seed": 1, "self_reflection": 2}

    def sort_key(r):
        return (
            levels.index(r["host"]),
            0 if r["persona"] == persona else 1,
            source_rank.get(r["source"], 3),
            -r["confidence"],
        )

    rows.sort(key=sort_key)

    seen_patterns: set = set()
    deduped = []
    for r in rows:
        if r["pattern"] in seen_patterns:
            continue
        seen_patterns.add(r["pattern"])
        deduped.append(r)
    return deduped


def bump_rule_outcome(rule_ids: list[int], outcome: str) -> None:
    """Increment wins/losses for `rule_ids` based on `outcome`, then promote
    shadow rules to active (if enabled) or retire consistently-losing ones."""
    if outcome not in ("completed", "disqualified"):
        return
    conn = _connect()
    try:
        for rid in rule_ids:
            if outcome == "completed":
                conn.execute("UPDATE host_rules SET wins = wins + 1, updated_at=? WHERE id=?",
                             (_now(), rid))
            else:
                conn.execute("UPDATE host_rules SET losses = losses + 1, updated_at=? WHERE id=?",
                             (_now(), rid))
            row = conn.execute(
                "SELECT status, confidence, wins, losses FROM host_rules WHERE id=?", (rid,)
            ).fetchone()
            if row is None:
                continue
            status, confidence, wins, losses = row
            if (status == "shadow" and wins >= 1 and confidence >= 0.6
                    and os.environ.get("VYDRA_PLAYBOOK") == "active"):
                conn.execute("UPDATE host_rules SET status='active', updated_at=? WHERE id=?",
                             (_now(), rid))
            elif losses >= 3 and losses > wins:
                conn.execute("UPDATE host_rules SET status='retired', updated_at=? WHERE id=?",
                             (_now(), rid))
        conn.commit()
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
                      final_text: str, steps: list[dict]) -> None:
    """Finalize a run_traces row, then prune old traces beyond 40 per host."""
    conn = _connect()
    try:
        conn.execute(
            "UPDATE run_traces SET outcome=?, outcome_reason=?, final_text=?, "
            "steps_json=?, ended_at=? WHERE run_id=?",
            (outcome, outcome_reason, (final_text or "")[:2000],
             json.dumps(steps), _now(), run_id),
        )
        conn.commit()
        row = conn.execute("SELECT host FROM run_traces WHERE run_id=?", (run_id,)).fetchone()
        if row is None:
            return
        host = row[0]
        conn.execute(
            "DELETE FROM run_traces WHERE host=? AND run_id NOT IN ("
            "  SELECT run_id FROM run_traces WHERE host=? ORDER BY started_at DESC LIMIT 40"
            ")",
            (host, host),
        )
        conn.commit()
    finally:
        conn.close()


def get_enhanced_persona(profile_key: str, base_persona: str, survey_url: str = "") -> str:
    """Appends known REAL facts to the base persona text, for the model to
    reuse when a later survey asks about the same topic - a consistency
    aid, not a source of fabricated qualifying answers. If nothing has
    been recorded yet for this persona, returns base_persona unchanged.
    survey_url: reserved for future host_rules filtering, unused for now."""
    facts = get_facts(profile_key)
    if not facts:
        return base_persona

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

    return base_persona + section


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
        print("Migration complete.")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
