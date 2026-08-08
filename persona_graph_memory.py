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


def get_enhanced_persona(profile_key: str, base_persona: str) -> str:
    """Appends known REAL facts to the base persona text, for the model to
    reuse when a later survey asks about the same topic - a consistency
    aid, not a source of fabricated qualifying answers. If nothing has
    been recorded yet for this persona, returns base_persona unchanged."""
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


def record_survey_outcome(profile_key: str, survey_url: str, status: str, payout: str = "") -> None:
    """History log entry for a completed/dry-run/disqualified survey pass -
    kept as a lightweight node+edge too, so it shows up in the same graph
    rather than a second parallel storage format."""
    conn = _connect()
    try:
        persona_id = f"persona:{profile_key}"
        host = survey_url.split("//", 1)[-1].split("/", 1)[0] if survey_url else "unknown"
        run_id = f"run:{profile_key}:{host}:{_now()}"
        _upsert_node(conn, persona_id, "persona", profile_key)
        _upsert_node(conn, run_id, "run", f"{status} {payout}".strip())
        _add_edge(conn, persona_id, run_id, "RAN")
        conn.commit()
        print(f"[graph_memory] Recorded run for profile={profile_key}: status={status} payout={payout}", flush=True)
    finally:
        conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:\n"
              "  persona_graph_memory.py record <persona> <topic> <value> [survey_url]\n"
              "  persona_graph_memory.py facts <persona>\n"
              "  persona_graph_memory.py history <persona> <topic>")
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
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
