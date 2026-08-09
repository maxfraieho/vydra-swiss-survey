"""
settings_api.py — Flask Blueprint for hosts, providers, personas, and patterns management API.
"""
from __future__ import annotations

import base64
import json
import os
import tempfile
import threading
import requests
from flask import Blueprint, jsonify, request
import persona_graph_memory
from vision import get_vision_backend, ProxyVisionBackend, LocalLlamaVisionBackend, VisionError

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


# --- AI Source Routes ---

_PROBE_LOCK = threading.Lock()
_PROBE_STATE = {
    "status": "idle",
    "progress": 0,
    "total": 0,
    "results": [],
    "error": None,
}


@settings_bp.route("/api/settings/ai-source", methods=["GET"])
# Auth enforced globally by astryx_survey_server.py's before_request gate.
# This endpoint exposes secret-configured state (token_configured).
def get_ai_source_config():
    try:
        cfg_str = persona_graph_memory.get_setting("ai_source_config")
        cfg = json.loads(cfg_str) if cfg_str else {}
        token_configured = bool(persona_graph_memory._read_secret_token())

        return jsonify({
            "backend": cfg.get("backend", "proxy"),
            "base_url": cfg.get("base_url", "http://192.168.3.184:18880"),
            "model": cfg.get("model", "multimedia-proxy"),
            "token_configured": token_configured,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/ai-source", methods=["PUT"])
def update_ai_source_config():
    try:
        data = request.get_json(silent=True) or {}
        backend = data.get("backend")
        if backend not in ("proxy", "local"):
            return jsonify({"error": "backend must be 'proxy' or 'local'"}), 400

        cfg_str = persona_graph_memory.get_setting("ai_source_config")
        cfg = json.loads(cfg_str) if cfg_str else {}

        cfg["backend"] = backend
        if "base_url" in data:
            cfg["base_url"] = data["base_url"]
        if "model" in data:
            cfg["model"] = data["model"]

        persona_graph_memory.set_setting("ai_source_config", json.dumps(cfg))

        if "token" in data:
            token_val = data["token"]
            if token_val == "" or token_val is None:
                persona_graph_memory._write_secret_token(None)
            else:
                persona_graph_memory._write_secret_token(token_val)

        token_configured = bool(persona_graph_memory._read_secret_token())
        return jsonify({
            "backend": cfg.get("backend", "proxy"),
            "base_url": cfg.get("base_url", "http://192.168.3.184:18880"),
            "model": cfg.get("model", "multimedia-proxy"),
            "token_configured": token_configured,
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/ai-source/test", methods=["POST"])
def test_ai_source():
    try:
        data = request.get_json(silent=True) or {}
        if data.get("backend"):
            backend_type = data["backend"]
            if backend_type == "local":
                backend = LocalLlamaVisionBackend(
                    model=data.get("model"),
                )
            else:
                token = data.get("token")
                if token is None:
                    token = persona_graph_memory._read_secret_token()
                backend = ProxyVisionBackend(
                    base_url=data.get("base_url"),
                    model=data.get("model"),
                    token=token,
                )
        else:
            backend = get_vision_backend()

        if isinstance(backend, LocalLlamaVisionBackend):
            try:
                from astryx_survey_server import CURRENT_PROC, ACTIVE_SURVEY_STATE
                if CURRENT_PROC is not None or ACTIVE_SURVEY_STATE.get("status") == "running":
                    return jsonify({"error": "A survey execution or model probe is already running"}), 409
            except (ImportError, AttributeError):
                pass
            if _PROBE_STATE["status"] == "running":
                return jsonify({"error": "A survey execution or model probe is already running"}), 409

        TINY_PNG_BYTES = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(TINY_PNG_BYTES)
            temp_path = f.name

        try:
            result_text = backend.run_vision(
                temp_path,
                prompt="Respond with OK if you process this test image.",
                timeout=90,
            )
            return jsonify({"ok": True, "detail": result_text[:300]})
        except Exception as e:
            return jsonify({"ok": False, "detail": str(e)})
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/api/settings/ai-source/probe-models", methods=["POST"])
def start_probe_models():
    global _PROBE_STATE
    # Check if a survey execution or probe is already running
    try:
        from astryx_survey_server import CURRENT_PROC, ACTIVE_SURVEY_STATE
        if CURRENT_PROC is not None or ACTIVE_SURVEY_STATE.get("status") == "running":
            return jsonify({"error": "A survey execution or model probe is already running"}), 409
    except (ImportError, AttributeError):
        pass

    with _PROBE_LOCK:
        if _PROBE_STATE["status"] == "running":
            return jsonify({"error": "A survey execution or model probe is already running"}), 409

        cfg_str = persona_graph_memory.get_setting("ai_source_config")
        cfg = json.loads(cfg_str) if cfg_str else {}
        backend_type = cfg.get("backend", "proxy")

        if backend_type == "local":
            models = [cfg.get("model") or "gemma-3-4b-it-Q4_K_M.gguf"]
        else:
            base_url = cfg.get("base_url", "http://192.168.3.184:18880")
            token = persona_graph_memory._read_secret_token() or "freecc"
            headers = {"Authorization": f"Bearer {token}"}
            try:
                resp = requests.get(f"{base_url}/v1/models", headers=headers, timeout=15)
                if resp.status_code == 200:
                    mdata = resp.json().get("data", [])
                    models = [m["id"] for m in mdata if isinstance(m, dict) and "id" in m]
                else:
                    models = [cfg.get("model", "multimedia-proxy")]
            except Exception:
                models = [cfg.get("model", "multimedia-proxy")]

        if not models:
            models = ["multimedia-proxy"]

        _PROBE_STATE = {
            "status": "running",
            "progress": 0,
            "total": len(models),
            "results": [],
            "error": None,
        }

        def _run_probe():
            global _PROBE_STATE
            TINY_PNG_BYTES = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            )
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                f.write(TINY_PNG_BYTES)
                temp_path = f.name

            try:
                for model_id in models:
                    if backend_type == "local":
                        backend_inst = LocalLlamaVisionBackend(model=model_id)
                    else:
                        token_val = persona_graph_memory._read_secret_token() or "freecc"
                        backend_inst = ProxyVisionBackend(
                            base_url=cfg.get("base_url"),
                            model=model_id,
                            token=token_val,
                        )

                    res_entry = {"model": model_id, "vision_capable": False, "detail": ""}
                    try:
                        out = backend_inst.run_vision(temp_path, "Respond OK if vision capable.", timeout=30)
                        res_entry["vision_capable"] = True
                        res_entry["detail"] = out[:200]
                    except Exception as ve:
                        res_entry["detail"] = str(ve)[:200]

                    with _PROBE_LOCK:
                        _PROBE_STATE["results"].append(res_entry)
                        _PROBE_STATE["progress"] += 1

                with _PROBE_LOCK:
                    _PROBE_STATE["status"] = "finished"
            except Exception as e:
                with _PROBE_LOCK:
                    _PROBE_STATE["status"] = "error"
                    _PROBE_STATE["error"] = str(e)
            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass

        threading.Thread(target=_run_probe, daemon=True).start()
        return jsonify({"status": "started"}), 200


@settings_bp.route("/api/settings/ai-source/probe-status", methods=["GET"])
def get_probe_status():
    with _PROBE_LOCK:
        return jsonify(_PROBE_STATE)

