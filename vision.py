"""Vision calls for the survey agent, routed through the Aegis Relay proxy
on dev-184 (LAN, no Cloudflare hop) instead of a local on-device model.

Was local llama-mtmd-cli (Gemma 3 4B, CPU/OpenCL) — replaced per explicit
instruction to stop using the on-device model and use the proxy's
multimedia-proxy slot instead, which self-selects the best currently
healthy vision-capable model (see /opt/free-claude-code
providers/nvidia_nim/model_monitor.py::_sync_multimedia_slot). The proxy
also does in-request failover across that slot's candidates, so no
client-side retry logic is needed here.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re

import requests

PROXY_BASE_URL = os.environ.get("AEGIS_PROXY_URL", "http://192.168.3.184:18880")
PROXY_MODEL = os.environ.get("AEGIS_PROXY_VISION_MODEL", "multimedia-proxy")
PROXY_TOKEN = os.environ.get("AEGIS_PROXY_TOKEN", "freecc")


class VisionError(RuntimeError):
    pass


class GemmaVision:
    """Stateless HTTP client for the proxy's multimedia-proxy slot.

    Keeps the same constructor/method shape as the old local-model class
    (use_gpu accepted for CLI back-compat, now a no-op — the proxy decides
    hardware/model, not the caller) so survey_agent.py needed no changes
    beyond this file.
    """

    def __init__(self, model=None, mmproj=None, mtmd_cli=None, use_gpu: bool = False):
        self.base_url = PROXY_BASE_URL
        self.proxy_model = PROXY_MODEL

    def run_vision(self, image_path: str, prompt: str, timeout: int = 120) -> str:
        mime_type, _ = mimetypes.guess_type(image_path)
        mime_type = mime_type or "image/png"
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        data_url = f"data:{mime_type};base64,{b64}"

        payload = {
            "model": self.proxy_model,
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
            "Authorization": f"Bearer {PROXY_TOKEN}",
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

    def decide_action(self, image_path: str, system_prompt: str, step_no: int) -> dict:
        """Ask the vision model what the SINGLE next action should be. Returns a dict:
        {"action": "click"|"type"|"scroll"|"done", "target_text": str, "value": str}

        Deliberately does NOT ask for pixel coordinates — TASK-65's
        agent_editor.py already found a 4B vision model can't invent good
        coordinates. It only names WHAT to interact with; cdp_client finds
        the element deterministically via DOM text search.
        """
        instruction = (
            f"{system_prompt}\n\n"
            "---\n"
            "Ти дивишся на скріншот сторінки опитування (крок "
            f"{step_no}). Виведи РІВНО ОДНУ наступну дію як JSON, без "
            "жодного іншого тексту:\n"
            '{"action": "click"|"type"|"scroll"|"done", '
            '"target_text": "видимий текст/лейбл елемента, який треба '
            'клікнути (наприклад: \'7\', \'Continuer\', \'Oui, plutôt '
            'd\'accord\')", "value": "текст для введення, якщо action=type"}\n'
            "Обери РІВНО одну дію: якщо ти на панелі акаунта — обирай конкретну кнопку чи назву доступного опитування (наприклад 'Sondage nº 171137', 'Sondage nº...', 'Voir tous les sondages disponibles', 'Participer', 'Commencer', 'Répondre') замість пунктів головного меню як 'Mes sondages' чи 'Mon profil'. "
            "Під час проходження опитування: обирай вибір відповіді або Continuer — "
            "НІКОЛИ не обирай Continuer, якщо на скріншоті питання ще не "
            "має обраної відповіді. Якщо опитування завершено — action=\"done\"."
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
