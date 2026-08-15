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

from cdp_client import CDPClient
from vision import GemmaVision, VisionError
import pipeline_bridge
import reflection
import run_state

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


def load_persona(profile_key: str, survey_url: str = "") -> tuple[str, list[int]]:
    from persona_graph_memory import get_persona, get_enhanced_persona
    p = get_persona(profile_key)
    if p is None:
        raise KeyError(profile_key)
    content = p.get("content_md", "")
    # Trim bulky agent framework instructions (e.g. ## A — ДІЯ) to pass only core
    # persona facts to Gemma, speeding up CPU vision prompt evaluation from ~80s to ~3-5s.
    for marker in ("## **A — ДІЯ**", "## A — ДІЯ"):
        if marker in content:
            content = content.split(marker)[0].strip()
            break
    applied_rule_ids: list[int] = []
    try:
        content, applied_rule_ids = get_enhanced_persona(profile_key, content, survey_url)
    except Exception as e:
        print(f"[survey_agent] Warning: Failed to apply dynamic memory: {e}", flush=True)
    return content, applied_rule_ids


def load_credentials(site_host: str, profile_key: str) -> dict | None:
    path = os.path.join(PROFILE_CACHE_DIR, "credentials.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        creds = json.load(f)
    return creds.get(site_host, {}).get(profile_key)


def try_login(client: CDPClient, creds: dict, log) -> None:
    """Deterministic login respecting browser pre-filled/cached credentials."""
    log("Checking login form and submitting cached/pre-filled credentials...")

    # First check if submit button can be directly clicked (pre-filled credentials)
    for label in LOGIN_FIELD_LABELS["submit"]:
        if client.click_by_text(label):
            time.sleep(2.0)
            log(f"Submitted pre-filled login via submit button {label!r}.")
            return

    # If submit wasn't immediately clickable, try email/password fields
    email_found = False
    for label in LOGIN_FIELD_LABELS["email"]:
        if client.click_by_text(label):
            client.type_text(creds["email"])
            email_found = True
            break

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
    ap.add_argument("--cdp-target", default=None,
                     help="browser_sources.key to use for this run, overriding the active "
                          "source without changing which one is active (default: active source, "
                          "see Settings → Браузер)")
    ap.add_argument("--resume-tab", default=None,
                     help="Exact URL of an already-open tab to attach to instead of "
                          "matching by domain or opening a new tab (manual resume flow).")
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
    ap.add_argument("--no-recovery", action="store_true",
                     help="Exit immediately on captcha detection instead of pausing/recovering.")
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

    persona, applied_rule_ids = load_persona(args.profile, args.url)
    site_host = args.url.split("//", 1)[-1].split("/", 1)[0].replace("www.", "")
    creds = load_credentials(site_host, args.profile)

    log(f"Resolving browser source (--cdp-target={args.cdp_target or 'active'})")
    client = CDPClient(args.local_port, cdp_target_key=args.cdp_target)
    log(f"CDP target resolved: {client.base}")
    vision = GemmaVision(use_gpu=args.gpu)
    screenshot_dir = tempfile.mkdtemp(prefix="survey-agent-")
    log(f"Screenshots for this run: {screenshot_dir}")

    try:
        log(f"Connecting to {args.url} as {PROFILES[args.profile]['label']}")
        SURVEY_PROVIDER_KEYWORDS = ("survey", "gfk", "bilendi", "maximiles", "cinode", "opinion", "cst_", "mriweb", "start.aspx")
        if args.resume_tab:
            log(f"Resuming in existing tab: {args.resume_tab}")
            is_existing = client.attach_exact_tab(args.resume_tab)
        else:
            is_existing = client.attach_or_open_tab(args.url)
        current_url = client.get_current_url()
        is_active_survey = is_existing and any(k in current_url.lower() for k in SURVEY_PROVIDER_KEYWORDS) and "ipinfo" not in current_url.lower()

        if is_active_survey:
            log(f"Attached to active tab on '{current_url}' — PRESERVING PAGE STATE (no re-navigation).")
        elif creds:
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
            captchas = client.detect_captcha_signatures()
            if captchas:
                log(f"CAPTCHA detected: {captchas}")
                if getattr(args, "no_recovery", False):
                    log("CLI flag --no-recovery set. Exiting immediately.")
                    stop_reason = "captcha_detected"
                    break
                else:
                    log("Pausing in waiting_verification state (captcha_detected) and notifying tutor...")
                    try:
                        from astryx_survey_server import notify_tutor_captcha_blocking
                        notify_tutor_captcha_blocking(args.profile, current_url, captchas)
                    except Exception as _e:
                        log(f"Warning: notify_tutor_captcha_blocking failed: {_e}")

                    pipeline_bridge.report_blocking("captcha_detected", {
                        "action": "captcha_solve",
                        "target_text": f"CAPTCHA: {', '.join(captchas)}",
                        "rationale": f"Виявлено захист: {', '.join(captchas)}",
                        "confidence": 0.99
                    })

                    resolved = False
                    start_wait = time.time()
                    while time.time() - start_wait < 600:
                        time.sleep(2.0)
                        server_status = pipeline_bridge.poll_operator_status()

                        if server_status in (run_state.IDLE, run_state.ERROR):
                            log("Task aborted by operator.")
                            stop_reason = "aborted_by_operator"
                            break

                        if server_status == run_state.RUNNING or not client.detect_captcha_signatures():
                            resolved = True
                            log("CAPTCHA resolved (operator resume or DOM check). Resuming execution.")
                            pipeline_bridge.report_running()
                            break
                    if not resolved:
                        if stop_reason != "aborted_by_operator":
                            log("CAPTCHA was not resolved within timeout.")
                            stop_reason = "captcha_timeout"
                        break

            shot_path = os.path.join(screenshot_dir, f"step-{step:03d}.png")
            client.screenshot(shot_path)
            ptxt = client.page_text()
            extra_keywords = {}
            try:
                import persona_graph_memory
                db_patterns = persona_graph_memory.list_patterns()
                for pat in db_patterns:
                    if pat.get("is_builtin") == 0:
                        kws = pat.get("keywords", [])
                        if isinstance(kws, str):
                            try:
                                kws = json.loads(kws)
                            except Exception:
                                kws = []
                        extra_keywords[pat["key"]] = kws if isinstance(kws, list) else []
            except Exception:
                pass
            topic = reflection.detect_pattern(ptxt, extra_keywords=extra_keywords)
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
            pipeline_bridge.verify_step(step=step, shot_path=shot_path, decision=decision,
                                        profile=args.profile, url=current_url,
                                        page_text=ptxt, pattern=topic, log=log)

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

            step_failed = False
            if action == "click":
                if not client.click_by_text(target):
                    log(f"Could not find exact element matching target_text={target!r} — attempting submit button fallback.")
                    sub = client.find_submit_button()
                    if sub:
                        import human_behavior
                        human_behavior.human_click_at(client, sub["x"], sub["y"])
                    else:
                        log(f"Target not found and no submit button available — skipping click for step {step}.")
                        step_failed = True
            elif action == "type":
                if target and not client.click_by_text(target):
                    step_failed = True
                client.type_text(value)
            elif action == "scroll":
                client.scroll()
            else:
                log(f"Unknown action {action!r} from Gemma — stopping.")
                stop_reason = "unknown_action"
                step_failed = True

            if step_failed and step == 1 and not captchas:
                log(f"⚠️ Undetected captcha or page blockage suspected at {current_url}")

            if stop_reason and stop_reason != "done":
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
            from persona_graph_memory import record_run_trace, bump_rule_outcome
            record_run_trace(run_id, outcome=outcome, outcome_reason=reason,
                              final_text=final_text[:2000], steps=trace_steps,
                              rules_used=applied_rule_ids)

            if applied_rule_ids:
                bump_rule_outcome(applied_rule_ids, outcome)

            if outcome in ("disqualified", "incomplete", "error"):
                lessons = reflection.reflect({
                    "run_id": run_id,
                    "outcome": outcome, "outcome_reason": reason,
                    "steps": trace_steps, "host": site_host, "persona": args.profile,
                })
                if lessons:
                    from persona_graph_memory import get_host_rules, record_host_rule
                    existing = get_host_rules(site_host, args.profile, include_shadow=True)
                    overridden = {r["pattern"] for r in existing if r["source"] == "human_override"}
                    for lesson in lessons:
                        if lesson["pattern"] in overridden:
                            continue
                        record_host_rule(
                            site_host, lesson["pattern"], lesson["behavior"],
                            persona=args.profile, source="self_reflection", status="shadow",
                            confidence=lesson["confidence"], evidence=lesson["evidence"],
                        )
        except Exception as e:
            log(f"Warning: Failed to record run trace: {e}")
    finally:
        client.close()
        log(f"Screenshots kept at {screenshot_dir}")


if __name__ == "__main__":
    main()
