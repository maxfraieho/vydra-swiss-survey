"""
rules_api.py — Flask Blueprint for rules management and trace inspection API.
Phase U1: read-only GET endpoints. Phase U3 (plan-ui-astryx-addendum.md §2.1):
adds PATCH/POST mutation endpoints, all gated behind X-Astryx-Token. Phase U4
(§2.3): per-host playbook gating via host_gates, POST /api/gate/<host>/approve.
"""
from __future__ import annotations

import functools
import json
import os
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


def _require_astryx_token(fn):
    """Gate a mutating route behind a shared secret (plan §2.1 "Безпека").

    If ASTRYX_API_TOKEN is unset in the environment, the route always answers
    503 (mutations disabled) rather than 401 - the plan calls this "no token
    in env -> mutating routes return 503", implemented here as an always-503
    response instead of conditional blueprint registration, since Flask routes
    are bound at import time; the effect at the HTTP boundary is the same."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        token = os.environ.get("ASTRYX_API_TOKEN")
        if not token:
            return jsonify({"error": "mutations disabled: ASTRYX_API_TOKEN not set"}), 503
        supplied = request.headers.get("X-Astryx-Token")
        if not supplied or supplied != token:
            return jsonify({"error": "invalid or missing X-Astryx-Token"}), 401
        return fn(*args, **kwargs)

    return wrapper


def _actor_from_request() -> str:
    """Single-operator system today (plan §7 open question #3): default actor
    is the constant 'human', optionally overridden by a header for forward
    compatibility with multiple named operators."""
    return request.headers.get("X-Astryx-Actor") or "human"


def _fetch_rule_dict(rule_id: int) -> Optional[dict]:
    """Full row + parsed evidence + effective/shadowed_by, for mutation responses."""
    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM host_rules WHERE id=?", (rule_id,)).fetchone()
        if row is None:
            return None
        d = dict(row)
        if d.get("evidence"):
            try:
                d["evidence"] = json.loads(d["evidence"])
            except Exception:
                pass
        eff, shadowed_by = _evaluate_rule_effectiveness(d)
        d["effective"] = eff
        d["shadowed_by"] = shadowed_by
        return d
    finally:
        conn.close()


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
        builtin_keys = list(getattr(reflection, "TOPIC_KEYWORDS", {}).keys())
        try:
            db_patterns = persona_graph_memory.list_patterns()
            extra_keys = [p["key"] for p in db_patterns if not p.get("is_builtin")]
        except Exception:
            extra_keys = []
        combined_keys = list(dict.fromkeys(builtin_keys + extra_keys))
        return jsonify({
            "topic_keywords": combined_keys,
            "qualifying_polarity": getattr(reflection, "QUALIFYING_POLARITY", {}),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to load vocabulary: {e}"}), 500


@rules_bp.route("/api/rules/report.md", methods=["GET"])
def get_report_md():
    """GET /api/rules/report.md: Markdown report render (rules_report.py, phase U0)."""
    import rules_report
    data = rules_report.collect()
    report_md = rules_report.render_markdown(data)
    return Response(report_md, mimetype="text/markdown")


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
    """GET /api/gate/<host>: host readiness metrics calculated from host_rules
    + host_gates. Phase U4: playbook_mode now comes from the host_gates table
    (host -> base_domain(host) -> '*' chain, same precedence as get_host_rules),
    not a plain env var - this is the same value get_enhanced_persona() acts on."""
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

        gate_row = None
        for lvl in (h, base_h, "*"):
            gate_row = conn.execute(
                "SELECT * FROM host_gates WHERE host=?", (lvl,)
            ).fetchone()
            if gate_row is not None:
                break
        playbook_mode = gate_row["playbook_mode"] if gate_row is not None else "shadow"

        has_completed_run = bool(list_traces(host=h, outcome="completed", limit=1))

        return jsonify({
            "host": h,
            "playbook_mode": playbook_mode,
            "gated_by": gate_row["host"] if gate_row is not None else None,
            "unreviewed_shadow_rules": unreviewed_shadow_count,
            "conflicts_count": conflicts_count,
            "missing_evidence_rules": missing_evidence_count,
            "total_rules": total_rules,
            "active_rules": active_rules,
            "retired_rules": retired_rules,
            "has_completed_run": has_completed_run,
            "ready_for_active": (unreviewed_shadow_count == 0 and conflicts_count == 0
                                  and has_completed_run),
        })
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Phase U3 — mutations. All routes below require X-Astryx-Token (see
# _require_astryx_token) and only ever touch host_rules + rule_audit.
# ---------------------------------------------------------------------------

@rules_bp.route("/api/rules/<int:rule_id>", methods=["PATCH"])
@_require_astryx_token
def patch_rule(rule_id: int):
    """PATCH /api/rules/<id>: {behavior?, confidence?, status?, note?} ->
    update_host_rule(). Never bumps confidence (defect #1) - writes exactly
    the given fields."""
    body = request.get_json(silent=True) or {}
    try:
        persona_graph_memory.update_host_rule(
            rule_id,
            behavior=body.get("behavior"),
            confidence=body.get("confidence"),
            status=body.get("status"),
            actor=_actor_from_request(),
            note=body.get("note"),
        )
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_fetch_rule_dict(rule_id))


@rules_bp.route("/api/rules", methods=["POST"])
@_require_astryx_token
def create_rule():
    """POST /api/rules: manual proactive rule creation. source='human_override'
    always. {host, pattern, behavior, persona?, confidence?, status?, note?}."""
    body = request.get_json(silent=True) or {}
    host, pattern, behavior = body.get("host"), body.get("pattern"), body.get("behavior")
    if not host or not pattern or not behavior:
        return jsonify({"error": "host, pattern and behavior are required"}), 400
    try:
        rule_id = persona_graph_memory.create_manual_rule(
            host, pattern, behavior,
            persona=body.get("persona", "*"),
            confidence=body.get("confidence", 0.7),
            status=body.get("status", "active"),
            actor=_actor_from_request(),
            note=body.get("note"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    return jsonify(_fetch_rule_dict(rule_id)), 201


@rules_bp.route("/api/rules/bulk", methods=["POST"])
@_require_astryx_token
def bulk_rules():
    """POST /api/rules/bulk: {ids[], op: promote|retire|delete, note?} in one
    transaction - partial failures (unknown ids) are skipped, not half-applied."""
    body = request.get_json(silent=True) or {}
    ids, op, note = body.get("ids"), body.get("op"), body.get("note")
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids must be a non-empty list"}), 400
    if op not in ("promote", "retire", "delete"):
        return jsonify({"error": "op must be one of promote|retire|delete"}), 400
    try:
        ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        return jsonify({"error": "ids must be integers"}), 400

    actor = _actor_from_request()
    if op == "promote":
        count = persona_graph_memory.bulk_set_status(ids, "active", actor=actor, note=note)
    elif op == "retire":
        count = persona_graph_memory.bulk_set_status(ids, "retired", actor=actor, note=note)
    else:
        count = persona_graph_memory.bulk_delete_rules(ids, actor=actor, note=note)
    return jsonify({"op": op, "requested": len(ids), "changed": count})


@rules_bp.route("/api/rules/<int:rule_id>/resolve_conflict", methods=["POST"])
@_require_astryx_token
def resolve_conflict(rule_id: int):
    """POST /api/rules/<id>/resolve_conflict: {winner_id, loser_action: retire|delete, note?}.

    <id> (path) and winner_id (body) must belong to the same (host, persona,
    pattern) conflict group. winner_id is set status='active'; every other row
    in that group gets loser_action applied. This is the explicit human
    decision on a human_override vs self_reflection conflict (plan §2.4 #7) -
    read-time precedence in get_host_rules() already picks a winner
    deterministically, this makes that choice permanent and audited."""
    body = request.get_json(silent=True) or {}
    winner_id, loser_action, note = body.get("winner_id"), body.get("loser_action"), body.get("note")
    if winner_id is None or loser_action not in ("retire", "delete"):
        return jsonify({"error": "winner_id and loser_action (retire|delete) are required"}), 400
    try:
        winner_id = int(winner_id)
    except (TypeError, ValueError):
        return jsonify({"error": "winner_id must be an integer"}), 400

    conn = persona_graph_memory._connect()
    conn.row_factory = sqlite3.Row
    try:
        anchor = conn.execute(
            "SELECT host, persona, pattern FROM host_rules WHERE id=?", (rule_id,)
        ).fetchone()
        if anchor is None:
            return jsonify({"error": f"Rule {rule_id} not found"}), 404
        winner_row = conn.execute(
            "SELECT host, persona, pattern FROM host_rules WHERE id=?", (winner_id,)
        ).fetchone()
        if winner_row is None:
            return jsonify({"error": f"winner_id {winner_id} not found"}), 404
        if tuple(anchor) != tuple(winner_row):
            return jsonify({
                "error": "rule_id and winner_id are not in the same conflict group "
                         "(host, persona, pattern must match)"
            }), 400
        group_ids = [r["id"] for r in conn.execute(
            "SELECT id FROM host_rules WHERE host=? AND persona=? AND pattern=?",
            tuple(anchor),
        ).fetchall()]
    finally:
        conn.close()

    actor = _actor_from_request()
    persona_graph_memory.update_host_rule(winner_id, status="active", actor=actor,
                                           note=note, audit_action="resolve_conflict")
    loser_ids = [i for i in group_ids if i != winner_id]
    if loser_ids:
        if loser_action == "retire":
            persona_graph_memory.bulk_set_status(loser_ids, "retired", actor=actor, note=note,
                                                  audit_action="resolve_conflict")
        else:
            persona_graph_memory.bulk_delete_rules(loser_ids, actor=actor, note=note,
                                                    audit_action="resolve_conflict")

    return jsonify({"winner_id": winner_id, "loser_ids": loser_ids, "loser_action": loser_action})


@rules_bp.route("/api/gate/<path:host>/approve", methods=["POST"])
@_require_astryx_token
def approve_host_gate(host: str):
    """POST /api/gate/<host>/approve: {playbook_mode?, promote_reviewed_shadow?, note?}.

    Phase U4 (plan-ui-astryx-addendum.md §2.1/§2.3): the human decision that
    turns per-host learning on. Two things happen in one call, matching the
    "gate screen" use-case (§2.4 #3):
      1. (default on) bulk-promote this host's shadow rules that already have
         a rule_audit trail (i.e. a human has actually looked at them, not
         just self_reflection dropping them in) to 'active'.
      2. switch host_gates.playbook_mode for this host (default 'active') -
         the value bump_rule_outcome() and get_enhanced_persona() now read.

    playbook_mode='off'/'shadow' is also accepted here so the same endpoint
    can walk a host back down, not just up."""
    h = norm_host(host)
    body = request.get_json(silent=True) or {}
    mode = body.get("playbook_mode", "active")
    promote_reviewed_shadow = body.get("promote_reviewed_shadow", True)
    note = body.get("note")
    actor = _actor_from_request()

    promoted_ids: list[int] = []
    if promote_reviewed_shadow:
        conn = persona_graph_memory._connect()
        try:
            rows = conn.execute(
                "SELECT DISTINCT hr.id FROM host_rules hr "
                "WHERE hr.host=? AND hr.status='shadow' "
                "AND EXISTS (SELECT 1 FROM rule_audit ra WHERE ra.rule_id = hr.id)",
                (h,),
            ).fetchall()
            promoted_ids = [r[0] for r in rows]
        finally:
            conn.close()
        if promoted_ids:
            persona_graph_memory.bulk_set_status(
                promoted_ids, "active", actor=actor, note=note, audit_action="promote"
            )

    try:
        gate = persona_graph_memory.set_host_gate(h, mode, actor=actor, note=note)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "host": h,
        "playbook_mode": gate["playbook_mode"],
        "promoted_rule_ids": promoted_ids,
        "gate": gate,
    })
