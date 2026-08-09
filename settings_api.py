"""
settings_api.py — Flask Blueprint for hosts, providers, personas, and patterns management API.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
import persona_graph_memory
from rules_api import _require_astryx_token

settings_bp = Blueprint("settings_api", __name__)


# --- Hosts Routes ---

@settings_bp.route("/api/settings/hosts", methods=["GET"])
def get_hosts():
    try:
        hosts = persona_graph_memory.list_hosts()
        return jsonify(hosts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/hosts", methods=["POST"])
@_require_astryx_token
def create_host():
    try:
        data = request.get_json(silent=True) or {}
        hostname = data.get("hostname")
        if not hostname:
            return jsonify({"error": "hostname is required"}), 400
        label = data.get("label", "")
        provider_id = data.get("provider_id")
        note = data.get("note")
        res = persona_graph_memory.create_host(
            hostname=hostname, label=label, provider_id=provider_id, note=note
        )
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/hosts/<int:id>", methods=["PATCH"])
@_require_astryx_token
def update_host(id: int):
    try:
        data = request.get_json(silent=True) or {}
        res = persona_graph_memory.update_host(id, **data)
        return jsonify(res), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/hosts/<int:id>", methods=["DELETE"])
@_require_astryx_token
def delete_host(id: int):
    try:
        ok = persona_graph_memory.delete_host(id)
        if not ok:
            return jsonify({"error": f"host id={id} not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Providers Routes ---

@settings_bp.route("/api/settings/providers", methods=["GET"])
def get_providers():
    try:
        providers = persona_graph_memory.list_providers()
        return jsonify(providers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/providers", methods=["POST"])
@_require_astryx_token
def create_provider():
    try:
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        label = data.get("label")
        if not key or not label:
            return jsonify({"error": "key and label are required"}), 400
        url_pattern = data.get("url_pattern")
        note = data.get("note")
        res = persona_graph_memory.create_provider(
            key=key, label=label, url_pattern=url_pattern, note=note
        )
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/providers/<int:id>", methods=["PATCH"])
@_require_astryx_token
def update_provider(id: int):
    try:
        data = request.get_json(silent=True) or {}
        res = persona_graph_memory.update_provider(id, **data)
        return jsonify(res), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/providers/<int:id>", methods=["DELETE"])
@_require_astryx_token
def delete_provider(id: int):
    try:
        ok = persona_graph_memory.delete_provider(id)
        if not ok:
            return jsonify({"error": f"provider id={id} not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Personas Routes ---

@settings_bp.route("/api/settings/personas", methods=["GET"])
def get_personas():
    try:
        personas = persona_graph_memory.list_personas()
        return jsonify(personas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/personas", methods=["POST"])
@_require_astryx_token
def create_persona():
    try:
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        label = data.get("label")
        if not key or not label:
            return jsonify({"error": "key and label are required"}), 400
        content_md = data.get("content_md", "")
        active = data.get("active", 1)
        res = persona_graph_memory.create_persona(
            key=key, label=label, content_md=content_md, active=active
        )
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/personas/<key>", methods=["PATCH"])
@_require_astryx_token
def update_persona(key: str):
    try:
        data = request.get_json(silent=True) or {}
        res = persona_graph_memory.update_persona(key, **data)
        return jsonify(res), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/personas/<key>", methods=["DELETE"])
@_require_astryx_token
def delete_persona(key: str):
    try:
        ok = persona_graph_memory.delete_persona(key)
        if not ok:
            return jsonify({"error": f"persona key={key!r} not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Patterns Routes ---

@settings_bp.route("/api/settings/patterns", methods=["GET"])
def get_patterns():
    try:
        patterns = persona_graph_memory.list_patterns()
        return jsonify(patterns)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/patterns", methods=["POST"])
@_require_astryx_token
def create_pattern():
    try:
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        if not key:
            return jsonify({"error": "key is required"}), 400
        label = data.get("label")
        keywords = data.get("keywords")
        qualifying_polarity = data.get("qualifying_polarity")
        res = persona_graph_memory.create_pattern(
            key=key, label=label, keywords=keywords, qualifying_polarity=qualifying_polarity
        )
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/patterns/<key>", methods=["PATCH"])
@_require_astryx_token
def update_pattern(key: str):
    try:
        data = request.get_json(silent=True) or {}
        res = persona_graph_memory.update_pattern(key, **data)
        return jsonify(res), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/patterns/<key>", methods=["DELETE"])
@_require_astryx_token
def delete_pattern(key: str):
    try:
        ok = persona_graph_memory.delete_pattern(key)
        if not ok:
            return jsonify({"error": f"pattern key={key!r} not found"}), 404
        return jsonify({"success": True}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
