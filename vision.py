"""Vision calls for the survey agent.

Supports strategy pattern with backends:
- ProxyVisionBackend: Aegis Relay proxy on dev-184 (LAN) or user-configured URL.
- LocalLlamaVisionBackend: On-device llama-mtmd-cli execution (Gemma 3 4B, CPU -t 4).
"""
from __future__ import annotations

import abc
import base64
import json
import mimetypes
import os
import re
import subprocess
import threading
from typing import Optional

import requests

PROXY_BASE_URL = os.environ.get("AEGIS_PROXY_URL", "http://192.168.3.184:18880")
PROXY_MODEL = os.environ.get("AEGIS_PROXY_VISION_MODEL", "multimedia-proxy")
PROXY_TOKEN = os.environ.get("AEGIS_PROXY_TOKEN", "freecc")

LOCAL_MODEL_DEFAULT = os.path.expanduser("~/models/gemma3-4b/gemma-3-4b-it-Q4_K_M.gguf")
LOCAL_MMPROJ_DEFAULT = os.path.expanduser("~/models/gemma3-4b/mmproj-model-f16.gguf")
LOCAL_MTMD_CLI_DEFAULT = os.path.expanduser("~/llama.cpp/build/bin/llama-mtmd-cli")
LOCAL_VISION_TIMEOUT = 600

_LOCAL_VISION_LOCK = threading.Lock()


class VisionError(RuntimeError):
    pass


class BaseVisionBackend(abc.ABC):
    @abc.abstractmethod
    def run_vision(self, image_path: str, prompt: str, timeout: Optional[int] = None) -> str:
        pass


class ProxyVisionBackend(BaseVisionBackend):
    """Stateless HTTP client for OpenAI-compatible vision proxies (e.g. Aegis Relay)."""

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or PROXY_BASE_URL
        self.model = model or PROXY_MODEL
        self.token = token if token is not None else PROXY_TOKEN

    def run_vision(self, image_path: str, prompt: str, timeout: Optional[int] = None) -> str:
        if timeout is None:
            timeout = 120
        mime_type, _ = mimetypes.guess_type(image_path)
        mime_type = mime_type or "image/png"
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        data_url = f"data:{mime_type};base64,{b64}"

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "max_tokens": 512,
            "temperature": 0.2,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }
        try:
            resp = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
        except requests.RequestException as e:
            raise VisionError(f"Aegis proxy request failed ({self.base_url}): {e}")

        if resp.status_code != 200:
            raise VisionError(
                f"Aegis proxy returned {resp.status_code}: {resp.text[:800]}"
            )
        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError) as e:
            raise VisionError(f"Unexpected proxy response shape: {e}: {resp.text[:400]!r}")


def _get_available_mem_kb() -> int:
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    parts = line.split()
                    return int(parts[1])
    except Exception:
        pass
    return 0


class LocalLlamaVisionBackend(BaseVisionBackend):
    """On-device llama-mtmd-cli runner with strict RAM preflight and thread constraints."""

    def __init__(self, model: Optional[str] = None, mmproj: Optional[str] = None, mtmd_cli: Optional[str] = None):
        self.model = model or LOCAL_MODEL_DEFAULT
        self.mmproj = mmproj or LOCAL_MMPROJ_DEFAULT
        self.mtmd_cli = mtmd_cli or LOCAL_MTMD_CLI_DEFAULT

    def run_vision(self, image_path: str, prompt: str, timeout: Optional[int] = None) -> str:
        if timeout is None:
            timeout = LOCAL_VISION_TIMEOUT

        # Preflight check: available memory must be >= 4.5 GB (4,718,592 kB)
        avail_kb = _get_available_mem_kb()
        if avail_kb == 0:
            raise VisionError(
                "Could not determine available memory from /proc/meminfo; refusing to run "
                "local vision inference without a RAM preflight check."
            )
        min_required_kb = int(4.5 * 1024 * 1024)
        if avail_kb < min_required_kb:
            avail_mb = avail_kb / 1024.0
            raise VisionError(
                f"Insufficient memory for local vision execution: {avail_mb:.1f} MB available, "
                f"at least 4608 MB (4.5 GB) required."
            )

        cmd = [
            self.mtmd_cli, "-m", self.model, "--mmproj", self.mmproj,
            "--image", image_path, "-c", "4096", "-n", "512",
            "--temp", "0.2", "-p", prompt, "-t", "4"
        ]

        proc_lock = None
        try:
            from astryx_survey_server import CURRENT_PROC_LOCK
            proc_lock = CURRENT_PROC_LOCK
        except (ImportError, AttributeError):
            pass

        def _exec():
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if res.returncode != 0:
                raise VisionError(
                    f"llama-mtmd-cli exited {res.returncode}: {res.stderr[-800:]}"
                )
            return res.stdout

        with _LOCAL_VISION_LOCK:
            if proc_lock:
                with proc_lock:
                    return _exec()
            else:
                return _exec()


_BACKEND_CACHE: dict[str, BaseVisionBackend] = {}


def get_vision_backend() -> BaseVisionBackend:
    """Factory function returning configured BaseVisionBackend instance based on app_settings.

    The built backend is cached by the raw ``ai_source_config`` string (SDD 022, R3):
    the setting is still read on every call, so a change made in the UI takes effect
    immediately, but the backend object — and the ``_connect()`` +
    ``executescript(SCHEMA)`` + 5x ``ALTER TABLE`` it costs to build one — is reused
    while the configuration string is unchanged. Backends are stateless, so sharing
    one instance across steps is safe.
    """
    import persona_graph_memory
    cfg_str = persona_graph_memory.get_setting("ai_source_config") or ""
    cached = _BACKEND_CACHE.get(cfg_str)
    if cached is not None:
        return cached
    backend = _build_vision_backend(cfg_str)
    _BACKEND_CACHE.clear()
    _BACKEND_CACHE[cfg_str] = backend
    return backend


def _build_vision_backend(cfg_str: str) -> BaseVisionBackend:
    """Uncached body of :func:`get_vision_backend` (unchanged logic)."""
    import persona_graph_memory
    if not cfg_str:
        return ProxyVisionBackend()

    cfg = json.loads(cfg_str)
    backend_type = cfg.get("backend", "proxy")
    if backend_type == "local":
        return LocalLlamaVisionBackend(
            model=cfg.get("model"),
            mmproj=cfg.get("mmproj"),
            mtmd_cli=cfg.get("mtmd_cli"),
        )
    elif backend_type == "proxy":
        secret_token = persona_graph_memory._read_secret_token()
        token = secret_token if secret_token is not None else cfg.get("token")
        return ProxyVisionBackend(
            base_url=cfg.get("base_url"),
            model=cfg.get("model"),
            token=token,
        )
    else:
        raise VisionError(f"Unknown ai_source_config backend type: {backend_type!r}")


class GemmaVision:
    """Backward-compatible wrapper for existing callers expecting GemmaVision."""

    def __init__(self, model=None, mmproj=None, mtmd_cli=None, use_gpu: bool = False):
        pass

    def run_vision(self, image_path: str, prompt: str, timeout: Optional[int] = None) -> str:
        backend = get_vision_backend()
        kwargs = {}
        if timeout is not None:
            kwargs["timeout"] = timeout
        return backend.run_vision(image_path, prompt, **kwargs)

    def decide_action(self, image_path: str, system_prompt: str, step_no: int) -> dict:
        instruction = (
            f"{system_prompt}\n\n"
            "---\n"
            "Ти дивишся на скріншот сторінки опитування (крок "
            f"{step_no}). Виведи РІВНО ОДНУ наступну дію як JSON з Zero-Hallucination Chain-of-Thought (CoT) структурою, без жодного іншого тексту:\n"
            "{\n"
            '  "visual_analysis": "Short analysis of visible UI controls and current page step",\n'
            '  "persona_matching": "Alignment of candidate choice with active persona rules",\n'
            '  "action": "click"|"type"|"scroll"|"done",\n'
            '  "target_text": "exact visible label or button text (NEVER invent pixel coordinates)",\n'
            '  "value": "text to type if action=type"\n'
            "}\n"
            "Обери РІВНО одну дію: якщо ти на панелі акаунта — обирай конкретну кнопку чи назву доступного опитування (наприклад 'Sondage nº 171137', 'Sondage nº...', 'Voir tous les sondages disponibles', 'Participer', 'Commencer', 'Répondre') замість пунктів головного меню як 'Mes sondages' чи 'Mon profil'. "
            "Під час проходження опитування: обирай вибір відповіді або Continuer — "
            "НІКОЛИ не обирай Continuer, якщо на скріншоті питання ще не "
            "має обраної відповіді. Якщо опитування завершено — action=\"done\". "
            "Категорично заборонено вигадувати або вказувати піксельні координати (NEVER invent pixel coordinates)."
        )
        raw = self.run_vision(image_path, instruction)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise VisionError(f"No JSON object in vision output: {raw[:400]!r}")
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as e:
            raise VisionError(f"Bad JSON from vision model: {e}: {match.group(0)[:400]!r}")
        if "action" not in data:
            raise VisionError(f"Vision JSON missing 'action': {data!r}")
        return data
