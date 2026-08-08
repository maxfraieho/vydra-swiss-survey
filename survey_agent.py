#!/usr/bin/env python3
"""Vydra mode 3: automated Swiss-panel survey filling via Gemma 3 4B vision,
driving an isolated SOCKS5-proxied Chrome window on the work laptop over CDP.

This is the third exclusive GPU mode on this phone, alongside Vydra
(translation, kindle-butch-gen) and the Bonsai-27B coding model
(~/llm-switch.sh). It performs the SAME busy-check kindle-butch-gen's
kbg_web/app.py::_heavy_state() and ~/llm-switch.sh::check_vydra_active()
already do (pgrep-based), so a running translation/NER/conversion/coding
job blocks a survey run and vice versa, without any change to those two
existing files being required for the check to work in that direction —
they already match on "llama-mtmd-cli", which this script also invokes.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

from cdp_client import CDPClient, REMOTE_PORTS, ensure_tunnel
from vision import GemmaVision, VisionError
import reflection

PROFILE_CACHE_DIR = os.path.expanduser("~/.vydra-survey-profiles")

PROFILES = {
    "arno": {"persona_file": "опитування.txt", "label": "Арно Дюбуа (Гланд, 25р.)"},
    "annet": {"persona_file": "Лена-опитування.txt", "label": "Аннет Буонасьє (Гланд, 52р.)"},
}

# Swiss survey sites are typically German or French. Try both when looking
# for standard login-form fields.
LOGIN_FIELD_LABELS = {
    "email": ["Email", "E-Mail", "E-mail-Adresse", "Adresse e-mail", "Benutzername", "Username",
              "Vos identifiants"],  # meinungsplatz.ch/login's actual French label - confirmed live 2026-07-27
    "password": ["Passwort", "Password", "Mot de passe"],
    "submit": ["Anmelden", "Login", "Einloggen", "Se connecter", "Connexion", "Log in", "Sign in", "S'identifier"],
}


def heavy_state_busy() -> list[str]:
    """Same pgrep patterns as kbg_web/app.py::_heavy_state() and
    llm-switch.sh::check_vydra_active() — deliberately re-implemented here
    rather than imported, since this repo is intentionally independent of
    kindle-butch-gen (per Q: no cross-repo code coupling)."""
    def up(pattern: str) -> bool:
        return subprocess.run(["pgrep", "-f", pattern], capture_output=True).returncode == 0

    checks = {
        "llama_server (Vydra/coding model)": up("llama-server"),
        "vision model (agent_editor.py / llama-mtmd-cli)": up("agent_editor.py") or up("llama-mtmd-cli"),
        "cast NER scan": up("cast_ner_prepass.py"),
        "book/manga conversion": (up("translate_manga.py") or up("run_conversion_batches.py")
                                   or up("translate_epub.py")),
    }
    return [name for name, active in checks.items() if active]


def load_persona(profile_key: str) -> str:
    path = os.path.join(PROFILE_CACHE_DIR, PROFILES[profile_key]["persona_file"])
    if not os.path.exists(path):
        raise SystemExit(
            f"Persona file not found at {path}\n"
            f"Run bin/sync_profiles.sh first to pull it from the dev server."
        )
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Trim bulky agent framework instructions (e.g. ## A — ДІЯ) to pass only core
    # persona facts to Gemma, speeding up CPU vision prompt evaluation from ~80s to ~3-5s.
    for marker in ("## **A — ДІЯ**", "## A — ДІЯ"):
        if marker in content:
            content = content.split(marker)[0].strip()
            break
    try:
        from persona_graph_memory import get_enhanced_persona
        content = get_enhanced_persona(profile_key, content)
    except Exception as e:
        print(f"[survey_agent] Warning: Failed to apply dynamic memory: {e}", flush=True)
    return content


def load_credentials(site_host: str, profile_key: str) -> dict | None:
    path = os.path.join(PROFILE_CACHE_DIR, "credentials.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        creds = json.load(f)
    return creds.get(site_host, {}).get(profile_key)


def try_login(client: CDPClient, creds: dict, log) -> None:
    """Deterministic login, not vision-driven — login forms are far more
    standardized than open-ended survey questions, so guessing field
    labels directly is both cheaper and more reliable than a vision call."""
    log("Attempting login via known field labels...")
    email_found = False
    for label in LOGIN_FIELD_LABELS["email"]:
        if client.click_by_text(label):
            client.type_text(creds["email"])
            email_found = True
            break
    if not email_found:
        log("Could not find an email/username field by label — leaving login to the vision loop.")
        return

    for label in LOGIN_FIELD_LABELS["password"]:
        if client.click_by_text(label):
            client.type_text(creds["password"])
            break

    for label in LOGIN_FIELD_LABELS["submit"]:
        if client.click_by_text(label):
            time.sleep(2.0)
            log(f"Submitted login via label {label!r}.")
            return
    log("Could not find a submit/login button by label — leaving to vision loop.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Vydra mode 3: Swiss survey agent (Gemma vision)")
    ap.add_argument("--profile", required=True, choices=sorted(PROFILES))
    ap.add_argument("--url", required=True)
    ap.add_argument("--cdp-target", default="survey", choices=sorted(REMOTE_PORTS),
                     help="Which isolated Swiss Chrome window to drive (default: survey, port 9225)")
    ap.add_argument("--local-port", type=int, default=19225)
    ap.add_argument("--max-steps", type=int, default=60,
                     help="Safety cap against a runaway loop — not a submission-consent gate.")
    ap.add_argument("--dry-run", action="store_true",
                     help="Run the full loop but stop instead of clicking anything that looks "
                          "like a final Submit/Continuer button. Off by default — Q explicitly "
                          "chose real submission from the start.")
    ap.add_argument("--force", action="store_true",
                     help="Skip the shared-GPU busy-check gate (mirrors llm-switch.sh -f).")
    ap.add_argument("--gpu", action="store_true",
                     help="Enable OpenCL GPU offload for Gemma vision (default is CPU-only for stability).")
    args = ap.parse_args()

    def log(msg: str) -> None:
        print(f"[survey_agent] {msg}", flush=True)

    run_id = ""
    try:
        from persona_graph_memory import start_run_trace
        run_id = start_run_trace(args.profile, args.url)
    except Exception as e:
        log(f"Warning: Failed to start run trace: {e}")

    busy = heavy_state_busy()
    if busy and not args.force:
        print(
            "\n⛔ [ОХОРОНА СИСТЕМИ] На телефоні вже зайнято: " + ", ".join(busy) + "\n"
            "Тільки ОДИН важкий режим (Vydra / кодинг-модель / опитування) може працювати "
            "одночасно — апаратне обмеження OnePlus 13.\n"
            "Зупиніть активний процес (llm-switch.sh stop) або передайте --force, якщо ви "
            "людина-розробник і свідомо приймаєте це рішення.\n",
            file=sys.stderr,
        )
        sys.exit(409)

    persona = load_persona(args.profile)
    site_host = args.url.split("//", 1)[-1].split("/", 1)[0].replace("www.", "")
    creds = load_credentials(site_host, args.profile)

    remote_port = REMOTE_PORTS[args.cdp_target]
    log(f"Ensuring CDP tunnel: local:{args.local_port} -> laptop:{remote_port} ({args.cdp_target})")
    ensure_tunnel(remote_port, args.local_port)

    client = CDPClient(args.local_port)
    vision = GemmaVision(use_gpu=args.gpu)
    screenshot_dir = tempfile.mkdtemp(prefix="survey-agent-")
    log(f"Screenshots for this run: {screenshot_dir}")

    try:
        log(f"Connecting to {args.url} as {PROFILES[args.profile]['label']}")
        SURVEY_PROVIDER_KEYWORDS = ("survey", "gfk", "bilendi", "maximiles", "cinode", "opinion", "cst_", "mriweb", "start.aspx")
        is_existing = client.attach_or_open_tab(args.url)
        current_url = client.get_current_url()
        is_active_survey = is_existing and any(k in current_url.lower() for k in SURVEY_PROVIDER_KEYWORDS) and "ipinfo" not in current_url.lower()
        # Only preserve state for a genuinely in-progress survey page -
        # "just sitting somewhere on the site" (home page, /login) is NOT
        # evidence of being authenticated, and there's no positive
        # logged-in check available. Skipping login whenever the tab
        # merely matched site_host previously caused the vision loop to
        # be handed an unauthenticated page it has no credentials to fix
        # (Gemma never sees the real email/password, only try_login()
        # does) and get stuck clicking the same label/submit pair in
        # circles. Confirmed live 2026-07-27. Re-running try_login() on
        # an already-authenticated session is harmless: click_by_text()
        # simply finds no login fields and falls through to the vision
        # loop, same as any other login attempt.

        if is_active_survey:
            log(f"Attached to active tab on '{current_url}' — PRESERVING PAGE STATE (no re-navigation).")
        elif creds:
            # Log in via the dedicated /login page, not the home page's
            # compact header widget - that widget's fields aren't proper
            # <label>-linked inputs (cdp_client.py's textOf() only reads
            # innerText/value/aria-label/title, never `placeholder`), so
            # click_by_text("Password") has nothing reliable to match and
            # can click the wrong element - confirmed live 2026-07-27: the
            # email field ended up with garbage appended instead of the
            # password reaching its own field. The full /login page has a
            # real form with distinct labeled fields (verified manually).
            scheme = args.url.split("://", 1)[0]
            login_url = f"{scheme}://{site_host}/login"
            log(f"Navigating to dedicated login page '{login_url}' (current URL was '{current_url}')...")
            client.navigate(login_url)
            try_login(client, creds, log)
            log(f"Navigating to survey URL '{args.url}'...")
            client.navigate(args.url)
        else:
            log(f"Navigating tab to site URL '{args.url}' (current URL was '{current_url}')...")
            client.navigate(args.url)
            log(f"No stored credentials for host={site_host!r} — skipping login step.")

        completed = False
        trace_steps: list[dict] = []
        stop_reason = None
        for step in range(1, args.max_steps + 1):
            shot_path = os.path.join(screenshot_dir, f"step-{step:03d}.png")
            client.screenshot(shot_path)
            ptxt = client.page_text()
            topic = reflection.detect_pattern(ptxt)
            try:
                decision = vision.decide_action(shot_path, persona, step)
            except Exception as _v_err:
                log(f"[Vision] Exception on step {step}: {_v_err}")
                decision = {"action": "wait", "reason": str(_v_err)}

            # Save latest screenshot for Astryx UI
            try:
                import shutil
                shutil.copy2(shot_path, os.path.expanduser("~/latest_survey_step.png"))
            except Exception:
                pass

            # Training / Verification hook with Astryx (Port 5005)
            try:
                import urllib.request
                import json as _json
                req = urllib.request.Request("http://127.0.0.1:5005/api/survey/verify_step",
                                             data=_json.dumps({
                                                 "step": step,
                                                 "shot_path": shot_path,
                                                 "decision": decision,
                                                 "profile": args.profile,
                                                 "url": current_url
                                             }).encode("utf-8"),
                                             headers={"Content-Type": "application/json"})
                resp = urllib.request.urlopen(req, timeout=300)
                verif_res = _json.loads(resp.read().decode("utf-8"))
                if verif_res.get("override_action"):
                    decision["action"] = verif_res.get("override_action")
                    decision["target_text"] = verif_res.get("override_target", decision.get("target_text"))
                    decision["value"] = verif_res.get("override_value", decision.get("value"))
                    log(f"[Verification Override] step {step}: action={decision['action']} target={decision['target_text']}")
            except Exception as _ve:
                pass

            action = decision.get("action")
            target = str(decision.get("target_text", ""))
            value = str(decision.get("value", ""))
            log(f"Step {step}: action={action!r} target={target!r} value={value!r}")

            trace_steps.append({"s": step, "t": topic, "q": ptxt[:120], "a": action, "tg": target, "v": value})

            if action == "done":
                log("Gemma reports the survey is complete.")
                completed = True
                stop_reason = "done"
                break

            is_final_looking = action == "click" and any(
                w in target.lower() for w in
                ("submit", "envoyer", "terminer", "senden", "abschicken", "finish", "завершити")
            )
            if args.dry_run and is_final_looking:
                log(f"[dry-run] Would click final-looking target {target!r} — stopping instead of submitting.")
                stop_reason = "dry_run_final"
                break

            if action == "click":
                if not client.click_by_text(target):
                    log(f"Could not find an element matching target_text={target!r} — "
                        f"stopping this run rather than guessing blindly.")
                    stop_reason = "target_not_found"
                    break
            elif action == "type":
                if target:
                    client.click_by_text(target)
                client.type_text(value)
            elif action == "scroll":
                client.scroll()
            else:
                log(f"Unknown action {action!r} from Gemma — stopping.")
                stop_reason = "unknown_action"
                break

            time.sleep(1.0)
        else:
            log(f"Hit --max-steps={args.max_steps} safety cap without Gemma reporting done.")
            stop_reason = "max_steps"

        log(f"Run finished. completed={completed}")
        try:
            from persona_graph_memory import record_survey_outcome
            status_str = "completed" if completed else ("dry_run" if args.dry_run else "incomplete")
            record_survey_outcome(args.profile, args.url, status_str)
        except Exception as e:
            log(f"Warning: Failed to record survey outcome: {e}")

        try:
            final_text = client.page_text()
            final_url = client.get_current_url()
            outcome, reason = reflection.classify_outcome(
                final_text, final_url,
                gemma_said_done=completed,
                dry_run=args.dry_run,
                hit_max_steps=(stop_reason == "max_steps"),
            )
            from persona_graph_memory import record_run_trace
            record_run_trace(run_id, outcome=outcome, outcome_reason=reason,
                              final_text=final_text[:2000], steps=trace_steps)
        except Exception as e:
            log(f"Warning: Failed to record run trace: {e}")
    finally:
        client.close()
        log(f"Screenshots kept at {screenshot_dir}")


if __name__ == "__main__":
    main()
