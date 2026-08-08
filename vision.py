"""Gemma 3 4B vision calls for the survey agent.

Reuses the exact invocation shape proven safe in kindle-butch-gen's
bin/agent_editor.py::run_vision() (CPU, -t 4, no -ngl — the fallback
path here is a byte-for-byte copy of that). The GPU-first path is new:
agent_editor.py never passed -ngl, so it always ran CPU-only by
omission, not by an explicit safety decision to avoid GPU specifically.
The llama-mtmd-cli binary at MTMD_CLI is linked against
libggml-opencl.so.0 (confirmed via readelf), so GPU offload here means
OpenCL + -ngl 99, not Vulkan (Vulkan support only exists in the separate
llama.cpp-multibackend build, which has no mtmd-cli binary).

Once a GPU attempt fails (crash, non-zero exit, or timeout) the agent
permanently downgrades to CPU for the rest of that run — this mirrors
how llm-switch.sh treats a dead process: don't keep re-fighting the
same crash.
"""
from __future__ import annotations

import json
import os
import re
import subprocess

MODEL_DEFAULT = os.path.expanduser("~/models/gemma3-4b/gemma-3-4b-it-Q4_K_M.gguf")
MMPROJ_DEFAULT = os.path.expanduser("~/models/gemma3-4b/mmproj-model-f16.gguf")
MTMD_CLI = os.path.expanduser("~/llama.cpp/build/bin/llama-mtmd-cli")

# Same LD_LIBRARY_PATH start-translation-server.sh exports so the OpenCL
# driver libs are found — agent_editor.py's CPU-only call never needed
# this because it never asked for GPU offload in the first place.
_GPU_ENV_EXTRA = {
    "LD_LIBRARY_PATH": ":".join([
        os.path.expanduser("~"),
        "/system/lib64",
        "/vendor/lib64",
        os.path.expandvars("$PREFIX/opt/vendor/lib"),
        os.path.expanduser("~/llama.cpp/build/bin"),
    ])
}


class VisionError(RuntimeError):
    pass


class GemmaVision:
    """Stateful only in that it remembers a GPU crash or CPU configuration —
    by default runs CPU-only (-t 4, -c 4096) to avoid OpenCL Adreno GPU lockups on Termux."""

    def __init__(self, model=MODEL_DEFAULT, mmproj=MMPROJ_DEFAULT, mtmd_cli=MTMD_CLI, use_gpu: bool = False):
        self.model = model
        self.mmproj = mmproj
        self.mtmd_cli = mtmd_cli
        self.gpu_disabled = not use_gpu

    def _run(self, image_path: str, prompt: str, use_gpu: bool, timeout: int) -> str:
        cmd = [self.mtmd_cli, "-m", self.model, "--mmproj", self.mmproj,
               "--image", image_path, "-c", "4096", "-n", "512",
               "--temp", "0.2", "-p", prompt]
        env = None
        if use_gpu:
            cmd += ["-ngl", "99"]
            env = {**os.environ, **_GPU_ENV_EXTRA}
        else:
            # Use all 8 Kryo/Oryon CPU cores on Snapdragon 8 Gen 4 for maximum CPU speed without GPU lockup
            cmd += ["-t", "8"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
        if res.returncode != 0:
            raise VisionError(
                f"llama-mtmd-cli exited {res.returncode} (gpu={use_gpu}): "
                f"{res.stderr[-800:]}"
            )
        return res.stdout

    def run_vision(self, image_path: str, prompt: str, timeout: int = 1200) -> str:
        if not self.gpu_disabled:
            try:
                return self._run(image_path, prompt, use_gpu=True, timeout=timeout)
            except (VisionError, subprocess.TimeoutExpired, OSError) as e:
                print(f"[vision] GPU attempt failed, downgrading to CPU for "
                      f"the rest of this run: {e}", flush=True)
                self.gpu_disabled = True
        return self._run(image_path, prompt, use_gpu=False, timeout=timeout)

    def decide_action(self, image_path: str, system_prompt: str, step_no: int) -> dict:
        """Ask Gemma what the SINGLE next action should be. Returns a dict:
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
            raise VisionError(f"No JSON object in Gemma output: {raw[:400]!r}")
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as e:
            raise VisionError(f"Bad JSON from Gemma: {e}: {match.group(0)[:400]!r}")
        if "action" not in data:
            raise VisionError(f"Gemma JSON missing 'action': {data!r}")
        return data
