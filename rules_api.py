"""
rules_api.py — Flask Blueprint for rules management and trace inspection API (Phase U1 - Read-Only)
"""
from __future__ import annotations

import json
import sqlite3
from typing import Optional, Any

from flask import Blueprint, jsonify, request, Response
import persona_graph_memory
from persona_graph_memory import (
    list_rules_raw,
    list_traces,
    get_trace,
    get_host_rules,
    norm_host,
    base_domain,
)

rules_bp = Blueprint("rules_api", __name__)


def _get_list_param(param_name: str) -> list[str] | None:
    """Helper to extract list parameters from request query params (e.g. ?host[]=a&host[]=b or ?host=a,b)."""
    raw_vals = request.args.getlist(f"{param_name}[]") + request.args.getlist(param_name)
    result: list[str] = []
    for v in raw_vals:
        if "," in v:
            result.extend(item.strip() for item in v.split(",") if item.strip())
        elif v.strip():
            result.append(v.strip())
    return result if result else None


def _evaluate_rule_effectiveness(rule: dict[str, Any]) -> tuple[bool, int | None]:
    """Determines whether `rule` is effective (wins deduplication in get_host_rules)
    and returns (effective_bool, shadowed_by_rule_id)."""
    host = rule.get("host") or "*"
    persona = rule.get("persona") or "*"
    pattern = rule.get("pattern")
    rule_id = rule.get("id")

    winning_rules = get_host_rules(host, persona, include_shadow=True)
    winner = None
    for w in winning_rules:
        if w.get("pattern") == pattern:
            winner = w
            break

    if winner and winner.get("id") == rule_id:
        return True, None
    elif winner:
        return False, winner.get("id")
    else:
        return True, None


@rules_bp.route("/api/rules", methods=["GET"])
def get_rules():
    """GET /api/rules: raw host_rules with filters + effective flag + shadowed_by id."""
    hosts = _get_list_param("host")
    personas = _get_list_param("persona")
    statuses = _get_list_param("status")
    sources = _get_list_param("source")
    q = request.args.get("q")
    sort = request.args.get("sort")
    order = request.args.get("order")
    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int, default=0)

    raw_rules = list_rules_raw(
        host=hosts,
        persona=personas,
        status=statuses,
        source=sources,
        q=q,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )

    annotated_rules = []
    for r in raw_rules:
        eff, shadowed_by = _evaluate_rule_effectiveness(r)
        r_copy = dict(r)
        r_copy["effective"] = eff
        r_copy["shadowed_by"] = shadowed_by
        annotated_rules.append(r_copy)

    return jsonify(annotated_rules)


@rules_bp.route("/api/rules/facets", methods=["GET"])
def get_facets():
    """GET /api/rules/facets: lists of hosts, personas, and sources with counts grouped by status."""
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT host, persona, source, status, COUNT(*) as cnt "
            "FROM host_rules GROUP BY host, persona, source, status"
        ).fetchall()

        hosts_map: dict[str, dict[str, Any]] = {}
        personas_map: dict[str, dict[str, Any]] = {}
        sources_map: dict[str, dict[str, Any]] = {}

        for r in rows:
            h, p, src, st, cnt = r["host"], r["persona"], r["source"], r["status"], r["cnt"]

            # Hosts
            if h not in hosts_map:
                hosts_map[h] = {"name": h, "count": 0, "by_status": {}}
            hosts_map[h]["count"] += cnt
            hosts_map[h]["by_status"][st] = hosts_map[h]["by_status"].get(st, 0) + cnt

            # Personas
            if p not in personas_map:
                personas_map[p] = {"name": p, "count": 0, "by_status": {}}
            personas_map[p]["count"] += cnt
            personas_map[p]["by_status"][st] = personas_map[p]["by_status"].get(st, 0) + cnt

            # Sources
            if src not in sources_map:
                sources_map[src] = {"name": src, "count": 0, "by_status": {}}
            sources_map[src]["count"] += cnt
            sources_map[src]["by_status"][st] = sources_map[src]["by_status"].get(st, 0) + cnt

        return jsonify({
            "hosts": list(hosts_map.values()),
            "personas": list(personas_map.values()),
            "sources": list(sources_map.values()),
        })
    finally:
        conn.close()


@rules_bp.route("/api/rules/compare", methods=["GET"])
def compare_rules():
    """GET /api/rules/compare?pattern=...: same pattern across all hosts/personas."""
    pattern = request.args.get("pattern")
    if not pattern:
        return jsonify({"error": "Query parameter 'pattern' is required"}), 400

    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT * FROM host_rules WHERE pattern=? ORDER BY host, persona, source",
            (pattern,),
        ).fetchall()

        result_rules = []
        for r in rows:
            d = dict(r)
            if d.get("evidence"):
                try:
                    d["evidence"] = json.loads(d["evidence"])
                except Exception:
                    pass
            eff, shadowed_by = _evaluate_rule_effectiveness(d)
            d["effective"] = eff
            d["shadowed_by"] = shadowed_by
            result_rules.append(d)

        return jsonify({
            "pattern": pattern,
            "count": len(result_rules),
            "rules": result_rules,
        })
    finally:
        conn.close()


@rules_bp.route("/api/rules/conflicts", methods=["GET"])
def get_conflicts():
    """GET /api/rules/conflicts: groups (host, persona, pattern) where >=2 rows have distinct source and distinct behavior."""
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        group_rows = conn.execute(
            "SELECT host, persona, pattern, COUNT(DISTINCT source) as src_cnt, COUNT(DISTINCT behavior) as beh_cnt "
            "FROM host_rules "
            "GROUP BY host, persona, pattern "
            "HAVING src_cnt >= 2 AND beh_cnt >= 2"
        ).fetchall()

        conflicts = []
        for g in group_rows:
            h, p, pat = g["host"], g["persona"], g["pattern"]
            rule_rows = conn.execute(
                "SELECT * FROM host_rules WHERE host=? AND persona=? AND pattern=?",
                (h, p, pat),
            ).fetchall()

            group_rules = []
            for r in rule_rows:
                d = dict(r)
                if d.get("evidence"):
                    try:
                        d["evidence"] = json.loads(d["evidence"])
                    except Exception:
                        pass
                eff, shadowed_by = _evaluate_rule_effectiveness(d)
                d["effective"] = eff
                d["shadowed_by"] = shadowed_by
                group_rules.append(d)

            conflicts.append({
                "host": h,
                "persona": p,
                "pattern": pat,
                "count": len(group_rules),
                "rules": group_rules,
            })

        return jsonify({
            "count": len(conflicts),
            "conflicts": conflicts,
        })
    finally:
        conn.close()


@rules_bp.route("/api/rules/vocabulary", methods=["GET"])
def get_vocabulary():
    """GET /api/rules/vocabulary: keys from reflection.TOPIC_KEYWORDS + QUALIFYING_POLARITY."""
    try:
        import reflection
        return jsonify({
            "topic_keywords": getattr(reflection, "TOPIC_KEYWORDS", {}),
            "qualifying_polarity": getattr(reflection, "QUALIFYING_POLARITY", {}),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to load vocabulary: {e}"}), 500


@rules_bp.route("/api/rules/report.md", methods=["GET"])
def get_report_md():
    """GET /api/rules/report.md: Markdown report render.
    TODO (Phase U0 missing): rules_report.py is not present in this checkout.
    When rules_report.py (Phase U0) is merged into master, update this route to call
    rules_report.generate_report() and return Response(report_md, mimetype="text/markdown").
    """
    return Response(
        "# TODO: rules_report.py (Phase U0) is not present in this checkout\n",
        status=501,
        mimetype="text/markdown",
    )


@rules_bp.route("/api/rules/<int:rule_id>", methods=["GET"])
def get_rule_by_id(rule_id: int):
    """GET /api/rules/<id>: full rule row + parsed evidence + linked_traces[]."""
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rule_id,)).fetchone()
        if row is None:
            return jsonify({"error": f"Rule {rule_id} not found"}), 404

        d = dict(row)
        if d.get("evidence"):
            try:
                d["evidence"] = json.loads(d["evidence"])
            except Exception:
                pass

        eff, shadowed_by = _evaluate_rule_effectiveness(d)
        d["effective"] = eff
        d["shadowed_by"] = shadowed_by

        linked_traces = []
        ev = d.get("evidence")
        run_ids_to_fetch: set[str] = set()
        if isinstance(ev, dict):
            if ev.get("run_id"):
                run_ids_to_fetch.add(str(ev["run_id"]))
            if isinstance(ev.get("run_ids"), list):
                for rid in ev["run_ids"]:
                    run_ids_to_fetch.add(str(rid))

        for rid in run_ids_to_fetch:
            t = get_trace(rid)
            if t:
                linked_traces.append(t)

        if not linked_traces and d.get("host") and d["host"] != "*":
            linked_traces = list_traces(host=d["host"], persona=d.get("persona"), limit=5)

        d["linked_traces"] = linked_traces
        return jsonify(d)
    finally:
        conn.close()


@rules_bp.route("/api/traces", methods=["GET"])
def get_traces():
    """GET /api/traces: run traces log with host/persona/outcome/limit filters."""
    hosts = _get_list_param("host")
    personas = _get_list_param("persona")
    outcomes = _get_list_param("outcome")
    limit = request.args.get("limit", type=int, default=50)
    offset = request.args.get("offset", type=int, default=0)

    traces = list_traces(
        host=hosts,
        persona=personas,
        outcome=outcomes,
        limit=limit,
        offset=offset,
    )
    return jsonify(traces)


@rules_bp.route("/api/traces/<path:run_id>", methods=["GET"])
def get_trace_by_id(run_id: str):
    """GET /api/traces/<run_id>: run steps (steps_json), final_text, outcome."""
    trace = get_trace(run_id)
    if trace is None:
        return jsonify({"error": f"Trace {run_id} not found"}), 404
    return jsonify(trace)


@rules_bp.route("/api/gate/<path:host>", methods=["GET"])
def get_host_gate(host: str):
    """GET /api/gate/<host>: host readiness metrics calculated from host_rules."""
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        h = norm_host(host)
        base_h = base_domain(h)

        rows = conn.execute(
            "SELECT * FROM host_rules WHERE host IN (?, ?, '*')",
            (h, base_h),
        ).fetchall()

        unreviewed_shadow_count = 0
        missing_evidence_count = 0
        total_rules = len(rows)
        active_rules = 0
        retired_rules = 0

        for r in rows:
            st = r["status"]
            if st == "shadow":
                unreviewed_shadow_count += 1
            elif st == "active":
                active_rules += 1
            elif st == "retired":
                retired_rules += 1

            ev = r["evidence"]
            if not ev or str(ev).strip() in ("", "{}", "null", "None"):
                missing_evidence_count += 1

        conflict_rows = conn.execute(
            "SELECT pattern, COUNT(DISTINCT source) as src_cnt, COUNT(DISTINCT behavior) as beh_cnt "
            "FROM host_rules "
            "WHERE host IN (?, ?, '*') "
            "GROUP BY host, persona, pattern "
            "HAVING src_cnt >= 2 AND beh_cnt >= 2",
            (h, base_h),
        ).fetchall()

        conflicts_count = len(conflict_rows)

        return jsonify({
            "host": h,
            "unreviewed_shadow_rules": unreviewed_shadow_count,
            "conflicts_count": conflicts_count,
            "missing_evidence_rules": missing_evidence_count,
            "total_rules": total_rules,
            "active_rules": active_rules,
            "retired_rules": retired_rules,
            "ready_for_active": (unreviewed_shadow_count == 0 and conflicts_count == 0),
        })
    finally:
        conn.close()
