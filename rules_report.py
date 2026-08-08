#!/usr/bin/env python3
"""
rules_report.py — read-only Markdown/Mermaid/stats snapshot of `host_rules`.

Phase U0 of docs/plan-ui-astryx-addendum.md. Deliberately a standalone
script: stdlib + sqlite3 only, no Flask/CDP/vision imports, so it can run
on its own against a live production DB without touching the hot path.

Opens ~/.vydra-survey-profiles/survey_graph.db strictly read-only
(`file:...?mode=ro`) — it never writes to the database. It does not
import `record_host_rule`, `get_host_rules`, or anything else from
`persona_graph_memory` that could write; only the `DB_PATH` constant is
imported from there so this file and the live agent never disagree about
where the database lives.

`evidence` is real people's survey answers (PII) and is never printed
unless `--with-evidence` is passed explicitly.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from typing import Optional

from persona_graph_memory import DB_PATH

STATUS_ORDER = ("active", "shadow", "retired")
STATUS_ICON = {"active": "✅", "shadow": "🕓", "retired": "🗄"}
STATUS_LABEL = {
    "active": "✅ active",
    "shadow": "🕓 shadow  (чекає на людський гейт)",
    "retired": "🗄 retired",
}


def _ro_connect(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Open the survey graph DB strictly read-only via a `mode=ro` URI.
    Raises if the file doesn't exist yet (URI mode=ro never creates it)."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def collect(
    hosts: Optional[list[str]] = None,
    personas: Optional[list[str]] = None,
    statuses: Optional[list[str]] = None,
    include_retired: bool = True,
) -> dict:
    """Read host_rules + run_traces read-only and return a normalized
    structure grouped host -> persona -> status -> [rule, ...].

    Each rule dict carries the raw host_rules columns plus a parsed
    `evidence_obj` (dict, or None if missing/unparseable)."""
    effective_statuses = list(statuses) if statuses else list(STATUS_ORDER)
    if not include_retired:
        effective_statuses = [s for s in effective_statuses if s != "retired"]

    conn = _ro_connect()
    try:
        where = []
        params: list = []
        if hosts:
            where.append("host IN (%s)" % ",".join("?" * len(hosts)))
            params.extend(hosts)
        if personas:
            where.append("persona IN (%s)" % ",".join("?" * len(personas)))
            params.extend(personas)
        if effective_statuses:
            where.append("status IN (%s)" % ",".join("?" * len(effective_statuses)))
            params.extend(effective_statuses)
        sql = "SELECT * FROM host_rules"
        if where:
            sql += " WHERE " + " AND ".join(where)
        rows = conn.execute(sql, params).fetchall()

        trace_counts: dict[str, int] = {}
        trace_latest: dict[str, str] = {}
        for trow in conn.execute(
            "SELECT host, COUNT(*) AS n, MAX(started_at) AS latest FROM run_traces GROUP BY host"
        ).fetchall():
            trace_counts[trow["host"]] = trow["n"]
            if trow["latest"]:
                trace_latest[trow["host"]] = trow["latest"]
    finally:
        conn.close()

    grouped: dict[str, dict[str, dict[str, list[dict]]]] = {}
    rule_count = 0
    status_totals = {"active": 0, "shadow": 0, "retired": 0}
    for row in rows:
        rule = dict(row)
        try:
            rule["evidence_obj"] = json.loads(rule["evidence"]) if rule["evidence"] else None
        except (json.JSONDecodeError, TypeError):
            rule["evidence_obj"] = None
        host = rule["host"]
        persona = rule["persona"]
        status = rule["status"]
        grouped.setdefault(host, {}).setdefault(persona, {}).setdefault(status, []).append(rule)
        rule_count += 1
        if status in status_totals:
            status_totals[status] += 1

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "db_path": DB_PATH,
        "rule_count": rule_count,
        "status_totals": status_totals,
        "hosts": grouped,
        "trace_counts": trace_counts,
        "trace_latest": trace_latest,
    }


def _truncate(text: str, n: int) -> str:
    text = text or ""
    if len(text) <= n:
        return text
    return text[: n - 1] + "…"


def _escape_pipe(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ")


def _fmt_conf(v) -> str:
    try:
        return f"{float(v):.2f}"
    except (TypeError, ValueError):
        return str(v)


def _sorted_hosts(data: dict) -> list[str]:
    return sorted(data["hosts"].keys())


def _sorted_personas(data: dict, host: str) -> list[str]:
    return sorted(data["hosts"][host].keys())


def _sorted_rules(rules: list[dict]) -> list[dict]:
    return sorted(rules, key=lambda r: (r["pattern"], r["source"], r["id"]))


def _summary_rows(data: dict) -> list[tuple]:
    """host, persona, active, shadow, retired, avg confidence, last updated_at."""
    rows = []
    for host in _sorted_hosts(data):
        for persona in _sorted_personas(data, host):
            statuses = data["hosts"][host][persona]
            counts = {s: len(statuses.get(s, [])) for s in STATUS_ORDER}
            all_rules = [r for s in STATUS_ORDER for r in statuses.get(s, [])]
            avg_conf = (
                sum(r["confidence"] for r in all_rules) / len(all_rules)
                if all_rules
                else 0.0
            )
            last_updated = max((r["updated_at"] for r in all_rules), default="")
            rows.append((host, persona, counts["active"], counts["shadow"], counts["retired"], avg_conf, last_updated))
    return rows


def _find_conflicts(data: dict) -> list[dict]:
    """Groups of (host, persona, pattern) with >=2 rules of different
    source AND different behavior."""
    groups: dict[tuple, list[dict]] = {}
    for host in data["hosts"]:
        for persona in data["hosts"][host]:
            for status in data["hosts"][host][persona]:
                for rule in data["hosts"][host][persona][status]:
                    key = (host, persona, rule["pattern"])
                    groups.setdefault(key, []).append(rule)

    conflicts = []
    for (host, persona, pattern), rules in sorted(groups.items()):
        sources = {r["source"]: r["behavior"] for r in rules}
        behaviors = set(sources.values())
        if len(sources) >= 2 and len(behaviors) >= 2:
            conflicts.append({
                "host": host, "persona": persona, "pattern": pattern,
                "rules": sorted(rules, key=lambda r: (r["source"], r["id"])),
            })
    return conflicts


def _find_host_divergence(data: dict) -> list[dict]:
    """Groups of (persona, pattern) present on >=2 different hosts with
    different behavior across those hosts."""
    groups: dict[tuple, list[dict]] = {}
    for host in data["hosts"]:
        for persona in data["hosts"][host]:
            for status in data["hosts"][host][persona]:
                for rule in data["hosts"][host][persona][status]:
                    key = (persona, rule["pattern"])
                    groups.setdefault(key, []).append(rule)

    divergences = []
    for (persona, pattern), rules in sorted(groups.items()):
        hosts_seen = {r["host"]: r["behavior"] for r in rules}
        if len(hosts_seen) >= 2 and len(set(hosts_seen.values())) >= 2:
            divergences.append({
                "persona": persona, "pattern": pattern,
                "rules": sorted(rules, key=lambda r: (r["host"], r["id"])),
            })
    return divergences


def render_markdown(
    data: dict,
    *,
    with_evidence: bool = False,
    with_mermaid: bool = True,
    max_mermaid_nodes: int = 40,
) -> str:
    lines: list[str] = []
    totals = data["status_totals"]
    lines.append(f"# host_rules snapshot — {data['generated_at']}")
    lines.append(
        f"DB: {data['db_path']} · правил: {data['rule_count']} "
        f"(active {totals.get('active', 0)} / shadow {totals.get('shadow', 0)} / "
        f"retired {totals.get('retired', 0)})"
    )
    lines.append("")

    if data["rule_count"] == 0:
        lines.append("_Правил немає._")
        return "\n".join(lines) + "\n"

    lines.append("## Зведення по хостах")
    lines.append("| host | persona | active | shadow | retired | сер. confidence | останнє оновлення |")
    lines.append("|---|---|---|---|---|---|---|")
    for host, persona, active, shadow, retired, avg_conf, last_updated in _summary_rows(data):
        lines.append(
            f"| {_escape_pipe(host)} | {_escape_pipe(persona)} | {active} | {shadow} | {retired} "
            f"| {avg_conf:.2f} | {last_updated or '—'} |"
        )
    lines.append("")

    for host in _sorted_hosts(data):
        lines.append(f"## {host}")
        for status in STATUS_ORDER:
            all_rules: list[dict] = []
            for persona in _sorted_personas(data, host):
                all_rules.extend(data["hosts"][host][persona].get(status, []))
            if not all_rules:
                continue
            all_rules = sorted(all_rules, key=lambda r: (r["persona"], r["pattern"], r["source"], r["id"]))
            lines.append(f"### {STATUS_LABEL[status]}")
            lines.append("| persona | pattern | source | conf | hits/wins/losses | behavior (120 симв.) | оновлено |")
            lines.append("|---|---|---|---|---|---|---|")
            details = []
            for rule in all_rules:
                behavior_full = rule["behavior"] or ""
                behavior_short = _escape_pipe(_truncate(behavior_full, 120))
                hwl = f"{rule['hits']}/{rule['wins']}/{rule['losses']}"
                lines.append(
                    f"| {_escape_pipe(rule['persona'])} | {_escape_pipe(rule['pattern'])} "
                    f"| {_escape_pipe(rule['source'])} | {_fmt_conf(rule['confidence'])} | {hwl} "
                    f"| {behavior_short} | {rule['updated_at']} |"
                )
                if len(behavior_full) > 120:
                    details.append((rule, behavior_full))
            for rule, behavior_full in details:
                lines.append("")
                lines.append(
                    f"<details><summary>#{rule['id']} {rule['persona']}/{rule['pattern']} "
                    f"({rule['source']}) — повний текст</summary>\n\n{behavior_full}\n\n</details>"
                )
            if with_evidence:
                evidenced = [r for r in all_rules if r.get("evidence_obj")]
                if evidenced:
                    lines.append("")
                    lines.append("<details><summary>evidence (PII — реальні відповіді)</summary>\n")
                    for rule in evidenced:
                        lines.append(f"- #{rule['id']} {rule['persona']}/{rule['pattern']}:")
                        lines.append("```json")
                        lines.append(json.dumps(rule["evidence_obj"], ensure_ascii=False, indent=2, sort_keys=True))
                        lines.append("```")
                    lines.append("</details>")
            lines.append("")

        if with_mermaid:
            lines.append("### Граф")
            lines.append("```mermaid")
            lines.append(render_mermaid(data, host, max_mermaid_nodes=max_mermaid_nodes))
            lines.append("```")
            lines.append("")

    conflicts = _find_conflicts(data)
    lines.append("## Конфлікти (той самий pattern, різні source, різний behavior)")
    if not conflicts:
        lines.append("_Конфліктів немає._")
    else:
        lines.append("| host | persona | pattern | source | conf | status | behavior (120 симв.) |")
        lines.append("|---|---|---|---|---|---|---|")
        for group in conflicts:
            for rule in group["rules"]:
                lines.append(
                    f"| {_escape_pipe(group['host'])} | {_escape_pipe(group['persona'])} "
                    f"| {_escape_pipe(group['pattern'])} | {_escape_pipe(rule['source'])} "
                    f"| {_fmt_conf(rule['confidence'])} | {rule['status']} "
                    f"| {_escape_pipe(_truncate(rule['behavior'] or '', 120))} |"
                )
    lines.append("")

    divergences = _find_host_divergence(data)
    lines.append("## Розбіжності між хостами (той самий pattern, різна поведінка)")
    if not divergences:
        lines.append("_Розбіжностей немає._")
    else:
        lines.append("| persona | pattern | host | source | status | behavior (120 симв.) |")
        lines.append("|---|---|---|---|---|---|---|")
        for group in divergences:
            for rule in group["rules"]:
                lines.append(
                    f"| {_escape_pipe(group['persona'])} | {_escape_pipe(group['pattern'])} "
                    f"| {_escape_pipe(rule['host'])} | {_escape_pipe(rule['source'])} | {rule['status']} "
                    f"| {_escape_pipe(_truncate(rule['behavior'] or '', 120))} |"
                )
    lines.append("")

    return "\n".join(lines) + "\n"


def render_mermaid(data: dict, host: str, max_mermaid_nodes: int = 40) -> str:
    """One `graph LR` per host: host -> pattern -> (source · status)."""
    lines = ["graph LR"]
    host_node = "H"
    lines.append(f'  {host_node}["{host}"]')

    all_rules: list[dict] = []
    for persona in data["hosts"].get(host, {}):
        for status in data["hosts"][host][persona]:
            all_rules.extend(data["hosts"][host][persona][status])
    all_rules = sorted(all_rules, key=lambda r: (-r["confidence"], r["pattern"], r["source"], r["id"]))

    shown = all_rules[:max_mermaid_nodes]
    hidden_count = len(all_rules) - len(shown)
    # deterministic display order after truncation: pattern -> persona -> source -> id
    shown = sorted(shown, key=lambda r: (r["pattern"], r["persona"], r["source"], r["id"]))

    pattern_node_ids: dict[str, str] = {}
    class_lines: dict[str, list[str]] = {"active": [], "shadow": [], "retired": []}

    for idx, rule in enumerate(shown):
        pkey = (rule["persona"], rule["pattern"])
        if pkey not in pattern_node_ids:
            pnode = f"P{len(pattern_node_ids) + 1}"
            pattern_node_ids[pkey] = pnode
            label = f"{rule['pattern']}<br/>{rule['persona']}"
            lines.append(f'  {host_node} --> {pnode}["{label}"]')
        pnode = pattern_node_ids[pkey]
        bnode = f"B{idx + 1}"
        blabel = f"{rule['source']} · {rule['status']}<br/>conf {_fmt_conf(rule['confidence'])}"
        lines.append(f'  {pnode} --> {bnode}["{blabel}"]')
        if rule["status"] in class_lines:
            class_lines[rule["status"]].append(bnode)

    lines.append("  classDef active fill:#064e3b,stroke:#10b981,color:#d1fae5;")
    lines.append("  classDef shadow fill:#1e1b4b,stroke:#818cf8,color:#e0e7ff;")
    lines.append("  classDef retired fill:#1f2937,stroke:#4b5563,color:#9ca3af;")
    for status, nodes in class_lines.items():
        if nodes:
            lines.append(f"  class {','.join(nodes)} {status};")

    if hidden_count > 0:
        lines.append(f'  MORE["+{hidden_count} правил не показано"]')
        lines.append(f"  {host_node} --> MORE")

    return "\n".join(lines)


def render_stats(data: dict) -> str:
    """Compact accept-rate table: host, pattern, hits/wins/losses, win-rate%."""
    rows = []
    for host in _sorted_hosts(data):
        by_pattern: dict[str, dict] = {}
        for persona in _sorted_personas(data, host):
            for status in STATUS_ORDER:
                for rule in data["hosts"][host][persona].get(status, []):
                    agg = by_pattern.setdefault(rule["pattern"], {"hits": 0, "wins": 0, "losses": 0})
                    agg["hits"] += rule["hits"]
                    agg["wins"] += rule["wins"]
                    agg["losses"] += rule["losses"]
        for pattern in sorted(by_pattern):
            agg = by_pattern[pattern]
            denom = agg["wins"] + agg["losses"]
            win_rate = (100.0 * agg["wins"] / denom) if denom else None
            rows.append((host, pattern, agg["hits"], agg["wins"], agg["losses"], win_rate))

    lines = ["# host_rules stats", ""]
    if not rows:
        lines.append("_Правил немає._")
        return "\n".join(lines) + "\n"

    lines.append("| host | pattern | hits | wins | losses | win-rate% |")
    lines.append("|---|---|---|---|---|---|")
    for host, pattern, hits, wins, losses, win_rate in rows:
        wr = f"{win_rate:.1f}" if win_rate is not None else "—"
        lines.append(f"| {_escape_pipe(host)} | {_escape_pipe(pattern)} | {hits} | {wins} | {losses} | {wr} |")
    return "\n".join(lines) + "\n"


def _parse_args(argv=None):
    p = argparse.ArgumentParser(description="Read-only Markdown/Mermaid/stats snapshot of host_rules.")
    p.add_argument("--host", action="append", dest="hosts", help="Filter by host (repeatable).")
    p.add_argument("--persona", action="append", dest="personas", help="Filter by persona (repeatable).")
    p.add_argument("--status", action="append", dest="statuses", choices=list(STATUS_ORDER),
                    help="Filter by status (repeatable).")
    p.add_argument("--no-retired", action="store_true", help="Exclude retired rules.")
    p.add_argument("--out", help="Write output to this path instead of stdout.")
    p.add_argument("--stats", action="store_true", help="Print accept-rate stats instead of the full report.")
    p.add_argument("--with-evidence", action="store_true",
                    help="Include evidence (PII) in the report. Never commit output with this flag.")
    p.add_argument("--no-mermaid", action="store_true", help="Skip Mermaid graphs.")
    p.add_argument("--max-mermaid-nodes", type=int, default=40, help="Max rule-nodes per host graph (default 40).")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = _parse_args(argv)
    data = collect(
        hosts=args.hosts,
        personas=args.personas,
        statuses=args.statuses,
        include_retired=not args.no_retired,
    )

    if args.stats:
        output = render_stats(data)
    else:
        output = render_markdown(
            data,
            with_evidence=args.with_evidence,
            with_mermaid=not args.no_mermaid,
            max_mermaid_nodes=args.max_mermaid_nodes,
        )

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
