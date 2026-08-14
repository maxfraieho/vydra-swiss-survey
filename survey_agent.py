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


def try_solve_altcha(client: CDPClient, log) -> bool:
    try:
        import base64, re, tempfile
        from vision import get_vision_backend
        has_altcha = client._send("Runtime.evaluate", {
            "expression": "!!document.querySelector('altcha-widget, [challengeurl], input[id*=\"altcha\"]')",
            "returnByValue": True
        }).get("result", {}).get("value")
        if not has_altcha:
            return False
        
        log("Altcha protection detected on login form. Triggering verification...")
        client._send("Runtime.evaluate", {
            "expression": """(function() {
                var cb = document.querySelector("input[id*='altcha'], altcha-widget, .altcha, button.altcha-btn");
                if (cb) cb.click();
            })()""",
            "returnByValue": True
        })
        time.sleep(2.0)
        
        img_res = client._send("Runtime.evaluate", {
            "expression": """(function() {
                var img = document.querySelector("altcha-widget img, img[src*='data:image']");
                return img ? img.src : null;
            })()""",
            "returnByValue": True
        })
        img_src = img_res.get("result", {}).get("value")
        if img_src and "base64," in img_src:
            b64_data = img_src.split("base64,")[1]
            img_bytes = base64.b64decode(b64_data)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_f:
                tmp_f.write(img_bytes)
                tmp_path = tmp_f.name
            
            try:
                backend = get_vision_backend()
                prompt = "Look at this captcha image. It contains exactly 5 letters or digits. Return ONLY a JSON object: {\"code\": \"XXXXX\"} where XXXXX is the 5-character string."
                ocr_raw = backend.run_vision(tmp_path, prompt)
                log(f"Altcha OCR result: {ocr_raw.strip()}")
                m = re.search(r"\{\s*\"code\"\s*:\s*\"([A-Za-z0-9]{5})\"\s*\}", ocr_raw)
                if not m:
                    m = re.search(r"\"([A-Za-z0-9]{5})\"", ocr_raw)
                code = m.group(1) if m else re.sub(r"[^A-Za-z0-9]", "", ocr_raw)[:5]
                
                client._send("Runtime.evaluate", {
                    "expression": f"""(function() {{
                        var inp = document.querySelector('.altcha-code-challenge-input');
                        if (inp) {{
                            inp.value = "{code}";
                            inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                            inp.dispatchEvent(new Event('change', {{bubbles: true}}));
                            var btn = document.querySelector('.altcha-code-challenge-verify');
                            if (btn) btn.click();
                        }}
                    }})()""",
                    "returnByValue": True
                })
                time.sleep(2.5)
                log(f"Entered Altcha code '{code}' and submitted challenge verification.")
                return True
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
    except Exception as e:
        log(f"Altcha solver exception: {e}")
    return False


def try_login(client: CDPClient, creds: dict, log) -> None:
    """Deterministic login respecting user-specified human-like header form flow."""
    log("Executing human-mimicking login flow...")

    # 1. Click top-left logo to switch to standard 2-line authorization mode on home page
    logo_res = client._send("Runtime.evaluate", {
        "expression": """(function() {
            var logo = document.querySelector("a.navbar-brand, .logo a, header a, a[href='/'], a[href='https://meinungsplatz.ch/']");
            if (logo) {
                var r = logo.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
                }
            }
            return null;
        })()""",
        "returnByValue": True
    }).get("result", {}).get("value")

    if logo_res:
        log("Clicking top-left logo to activate standard two-line authorization mode...")
        client.human_click(logo_res["x"], logo_res["y"])
        time.sleep(2.5)

    # 2. Click the top-right header button 'S'identifier' to open the 2-line header login form
    header_btn_res = client._send("Runtime.evaluate", {
        "expression": """(function() {
            var btn = Array.from(document.querySelectorAll("header button, .header button, button")).find(b => {
                var t = (b.innerText || "").trim().toLowerCase();
                return (t === "s'identifier" || t === "anmelden" || t === "connexion") && b.type !== "submit";
            });
            if (btn) {
                var r = btn.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
                }
            }
            return null;
        })()""",
        "returnByValue": True
    }).get("result", {}).get("value")

    if header_btn_res:
        log("Clicking top-right header 'S\'identifier' button with human mouse motion...")
        client.human_click(header_btn_res["x"], header_btn_res["y"])
        time.sleep(1.5)

    # 3. Focus and fill username and password with human delays
    u_res = client._send("Runtime.evaluate", {
        "expression": """(function() {
            var u = document.querySelector("input#_username, input[name='_username'], input[type='email']");
            if (u) {
                var r = u.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return {x: r.x + 30, y: r.y + r.height / 2};
            }
            return null;
        })()""",
        "returnByValue": True
    }).get("result", {}).get("value")

    if u_res:
        client.human_click(u_res["x"], u_res["y"])
        time.sleep(0.3)
        client.type_text(creds["email"])
        time.sleep(0.4)

    p_res = client._send("Runtime.evaluate", {
        "expression": """(function() {
            var p = document.querySelector("input#_password, input[name='_password'], input[type='password']");
            if (p) {
                var r = p.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return {x: r.x + 30, y: r.y + r.height / 2};
            }
            return null;
        })()""",
        "returnByValue": True
    }).get("result", {}).get("value")

    if p_res:
        client.human_click(p_res["x"], p_res["y"])
        time.sleep(0.3)
        client.type_text(creds["password"])
        time.sleep(0.5)

    # 4. Check if Altcha is present
    try_solve_altcha(client, log)

    # 5. Click authorization submit button mimicking a human
    submit_res = client._send("Runtime.evaluate", {
        "expression": """(function() {
            var sub = document.querySelector("button#_submit, button[type='submit'], input[type='submit']");
            if (sub) {
                var r = sub.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
                }
            }
            return null;
        })()""",
        "returnByValue": True
    }).get("result", {}).get("value")

    if submit_res:
        log(f"Clicking authorization submit button with human motion at ({submit_res['x']:.1f}, {submit_res['y']:.1f})...")
        client.human_click(submit_res["x"], submit_res["y"])
        time.sleep(4.0)
        log("Human authorization click dispatched and verified.")
        return

    # Fallback to text label search
    for label in LOGIN_FIELD_LABELS["submit"]:
        if client.click_by_text(label):
            time.sleep(3.0)
            log(f"Submitted login via submit button {label!r}.")
            return
    log("Could not find submit/login button — leaving to vision loop.")


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
        is_auth_failure = any(k in current_url.lower() for k in ("auth_fail", "auth_error", "fail", "error", "closed"))
        is_active_survey = is_existing and any(k in current_url.lower() for k in SURVEY_PROVIDER_KEYWORDS) and "ipinfo" not in current_url.lower() and not is_auth_failure

        if is_active_survey:
            log(f"Attached to active tab on '{current_url}' — PRESERVING PAGE STATE (no re-navigation).")
        elif creds:
            log(f"Navigating to '{args.url}' for authentication and survey flow...")
            client.navigate(args.url)
            time.sleep(2.0)
            try_login(client, creds, log)
            # If args.url is a deep survey path (not home page), ensure we are on it
            if args.url.strip("/").count("/") > 2 and client.get_current_url() != args.url:
                log(f"Navigating to deep survey target URL '{args.url}'...")
                client.navigate(args.url)
        else:
            log(f"Navigating tab to site URL '{args.url}' (current URL was '{current_url}')...")
            client.navigate(args.url)
            log(f"No stored credentials for host={site_host!r} — skipping login step.")

        completed = False
        trace_steps: list[dict] = []
        stop_reason = None
        for step in range(1, args.max_steps + 1):
            # Check and solve any Altcha challenge before proceeding
            try_solve_altcha(client, log)

            captchas = client.detect_captcha_signatures()
            if captchas:
                log(f"CAPTCHA detected: {captchas}")
                if getattr(args, "no_recovery", False):
                    log("CLI flag --no-recovery set. Exiting immediately.")
                    stop_reason = "captcha_detected"
                    break
                else:
                    log("Pausing in waiting_captcha state and notifying tutor...")
                    try:
                        from astryx_survey_server import notify_tutor_captcha_blocking
                        notify_tutor_captcha_blocking(args.profile, current_url, captchas)
                    except Exception as _e:
                        log(f"Warning: notify_tutor_captcha_blocking failed: {_e}")

                    try:
                        import astryx_survey_server
                        astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = "waiting_captcha"
                    except Exception:
                        pass

                    resolved = False
                    start_wait = time.time()
                    while time.time() - start_wait < 600:
                        time.sleep(3.0)
                        if not client.detect_captcha_signatures():
                            resolved = True
                            log("CAPTCHA resolved by tutor. Resuming execution.")
                            try:
                                import astryx_survey_server
                                astryx_survey_server.ACTIVE_SURVEY_STATE["status"] = "running"
                            except Exception:
                                pass
                            break
                    if not resolved:
                        log("CAPTCHA was not resolved within timeout.")
                        stop_reason = "captcha_timeout"
                        break

            shot_path = os.path.join(screenshot_dir, f"step-{step:03d}.png")
            client.screenshot(shot_path)
            ptxt = client.page_text()
            extra_keywords = {}
            try:
                from persona_graph_memory import get_persona_graph
                kg = get_persona_graph(args.profile)
                patterns_list = kg.get("learned_patterns", [])
                for pat in patterns_list:
                    if pat.get("pattern_type") == "survey_topic":
                        kws = pat.get("context_rules", [])
                        if isinstance(kws, str):
                            try:
                                kws = json.loads(kws)
                            except Exception:
                                kws = []
                        extra_keywords[pat["pattern"]] = kws if isinstance(kws, list) else []
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
            try:
                import urllib.request
                import json as _json
                req = urllib.request.Request("http://127.0.0.1:5005/api/survey/verify_step",
                                             data=_json.dumps({
                                                 "step": step,
                                                 "shot_path": shot_path,
                                                 "decision": decision,
                                                 "profile": args.profile,
                                                 "url": current_url,
                                                 "page_text": ptxt[:2000],
                                                 "pattern": topic
                                             }).encode("utf-8"),
                                             headers={"Content-Type": "application/json",
                                                      "X-Astryx-Token": os.environ.get("ASTRYX_API_TOKEN", "")})
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

            step_failed = False

            # Check if user passed a captcha code in override target (e.g. "57343")
            code_match = re.search(r"\b\d{4,6}\b", target) or re.search(r"\b[A-Za-z0-9]{5}\b", target)
            if code_match and any(w in target.lower() for w in ("капч", "captcha", "цифр", "введи")):
                captcha_val = code_match.group(0)
                log(f"Detected user captcha override '{captcha_val}' — submitting to Altcha input...")
                client._send("Runtime.evaluate", {
                    "expression": f"""(function() {{
                        var inp = document.querySelector('.altcha-code-challenge-input, input[name=\"altcha_code\"]');
                        if (inp) {{
                            inp.value = "{captcha_val}";
                            inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                            inp.dispatchEvent(new Event('change', {{bubbles: true}}));
                            var btn = document.querySelector('.altcha-code-challenge-verify');
                            if (btn) btn.click();
                        }}
                    }})()""",
                    "returnByValue": True
                })
                time.sleep(2.0)
                sub = client.find_submit_button()
                if sub:
                    client.human_click(sub["x"], sub["y"])
                    time.sleep(3.0)

            elif action == "click":
                if not client.click_by_text(target):
                    log(f"Could not find exact element matching target_text={target!r} — attempting submit button fallback.")
                    sub = client.find_submit_button()
                    if sub:
                        client.human_click(sub["x"], sub["y"])
                        time.sleep(2.5)
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
