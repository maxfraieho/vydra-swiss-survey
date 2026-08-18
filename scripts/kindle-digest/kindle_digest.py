#!/usr/bin/env python3
"""Generate an SDD telemetry digest (Markdown -> EPUB -> Kindle send).

Per specs/kindle-digest-design.md in vydra-swiss-survey. v1 scope: git
log activity, feature.json state (+ history via `git log -p`), judge
verdicts if any exist. Blast Radius Matrix / GitNexus-based filtered
diffs are NOT in v1 — that needs GitNexus wired into this script, a
later addition (documented as a gap, not silently skipped).

Usage:
  python3 kindle_digest.py --repo /path/to/repo --window daily|weekly [--dry-run] [--no-send]
"""
import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from md_to_epub import build_epub  # noqa: E402
from send_digest import send_digest  # noqa: E402

WINDOWS = {"daily": "24 hours ago", "weekly": "7 days ago"}


def run(repo: Path, *args: str) -> str:
    res = subprocess.run(
        ["git", "-C", str(repo)] + list(args), capture_output=True, text=True
    )
    return res.stdout.strip()


def load_feature_json(repo: Path) -> dict:
    fj = repo / ".specify" / "feature.json"
    if not fj.exists():
        return {}
    try:
        return json.loads(fj.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def get_judge_verdicts(repo: Path, since_arg: str) -> list[dict]:
    log_dir = repo / "logs" / "sdd_judge"
    if not log_dir.exists():
        return []
    cutoff = time.time() - (86400 if "24 hours" in since_arg else 7 * 86400)
    verdicts = []
    for f in sorted(log_dir.glob("*.json")):
        if f.stat().st_mtime < cutoff:
            continue
        try:
            verdicts.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return verdicts


def build_briefing(repo: Path, window: str, since_arg: str) -> str:
    feature = load_feature_json(repo)
    branch = run(repo, "rev-parse", "--abbrev-ref", "HEAD")
    commit_count = run(repo, "rev-list", "--count", f"--since={since_arg}", "HEAD")
    numstat = run(repo, "log", f"--since={since_arg}", "--numstat", "--pretty=format:")
    files_touched = {line.split("\t")[2] for line in numstat.splitlines() if "\t" in line}
    verdicts = get_judge_verdicts(repo, since_arg)
    fails = [v for v in verdicts if v.get("verdict") == "FAIL"]

    lines = [
        f"# SDD Digest — {window} — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n",
        "## Master Executive Briefing\n",
        f"**Гілка:** `{branch}`  ",
        f"**Активна фіча:** `{feature.get('feature_id', '(немає)')}`, фаза `{feature.get('phase', '?')}`, "
        f"власник `{feature.get('owner_agent', '?')}`, host `{feature.get('host', '?')}`  ",
        f"**Комітів за вікно:** {commit_count}  ",
        f"**Файлів торкнулось:** {len(files_touched)}  ",
    ]
    if fails:
        lines.append(f"\n⚠️ **{len(fails)} FAIL-вердикт(ів) від арбітра за вікно (shadow mode — жоден не заблокував коміт):**\n")
        for v in fails:
            lines.append(f"- {v.get('summary', '(без опису)')}")
    else:
        lines.append(f"\nАрбітр: {len(verdicts)} вердикт(ів) за вікно, FAIL немає.")
        if not (repo / "logs" / "sdd_judge").exists():
            lines.append(" (`logs/sdd_judge/` ще не існує — арбітр жодного разу не спрацював з робочим ключем за цей період.)")
    return "\n".join(lines) + "\n"


def build_phase_checklist(repo: Path) -> str:
    feature = load_feature_json(repo)
    lines = ["## Phase Checklist\n"]
    phases_done = feature.get("phases_done", [])
    phase = feature.get("phase", "")
    all_phases = ["specify", "clarify", "plan", "tasks", "implement", "verify"]
    for p in all_phases:
        mark = "[x]" if p in phases_done or p == phase else "[ ]"
        current = " ← поточна" if p == phase else ""
        lines.append(f"- {mark} {p}{current}")

    spec_dir = feature.get("spec_dir", "")
    if spec_dir and (repo / spec_dir / "tasks.md").exists():
        tasks_text = (repo / spec_dir / "tasks.md").read_text()
        unchecked = re.findall(r"^- \[ \] (.+)$", tasks_text, re.MULTILINE)
        if unchecked:
            lines.append(f"\n**Незакриті задачі ({len(unchecked)}) в `{spec_dir}/tasks.md`:**\n")
            for t in unchecked[:15]:
                lines.append(f"- {t}")
            if len(unchecked) > 15:
                lines.append(f"- ...і ще {len(unchecked) - 15}")
    return "\n".join(lines) + "\n"


def build_spec_diffs(repo: Path, since_arg: str) -> str:
    feature = load_feature_json(repo)
    watch_paths = [".specify/constitution.md", "AGENTS.md", ".specify/feature.json"]
    spec_dir = feature.get("spec_dir", "")
    if spec_dir:
        watch_paths += [f"{spec_dir}/spec.md", f"{spec_dir}/plan.md", f"{spec_dir}/tasks.md"]

    lines = ["## Semantic Spec Diffs\n"]
    any_change = False
    for p in watch_paths:
        if not (repo / p).exists():
            continue
        log = run(repo, "log", f"--since={since_arg}", "--oneline", "--", p)
        if log:
            any_change = True
            lines.append(f"### `{p}`\n")
            for entry in log.splitlines()[:5]:
                lines.append(f"- {entry}")
            lines.append("")
    if not any_change:
        lines.append("Без змін політики/специфікацій за це вікно.")
    return "\n".join(lines) + "\n"


def build_adr_delta(repo: Path, since_arg: str) -> str:
    raw = run(
        repo,
        "log",
        f"--since={since_arg}",
        "--name-only",
        "--diff-filter=AM",
        "--pretty=format:",
        "--",
        "docs/adr/",
    )
    adr_files: list[str] = []
    for line in raw.splitlines():
        line = line.strip()
        if line and line.endswith(".md") and not line.endswith("template.md"):
            if line not in adr_files:
                adr_files.append(line)

    lines = ["## Edition: What Changed Since Last Release\n"]
    if not adr_files:
        lines.append("Без архітектурних змін за це видання.\n")
        return "\n".join(lines)

    lines.append("### New & Changed ADRs\n")
    for adr_rel in adr_files:
        file_path = repo / adr_rel
        summary = ""
        if file_path.exists():
            try:
                content = file_path.read_text(encoding="utf-8")
                match = re.search(
                    r"##\s+(?:Підсумок рішення|Decision Outcome)\s*\n+(.*?)(?=\n+##|\Z)",
                    content,
                    re.DOTALL | re.IGNORECASE,
                )
                if match:
                    summary = match.group(1).strip()
                else:
                    paragraphs = [
                        p.strip()
                        for p in content.split("\n\n")
                        if p.strip() and not p.strip().startswith("#")
                    ]
                    summary = paragraphs[0] if paragraphs else "(Опис відсутній)"
            except OSError:
                summary = "(Не вдалося прочитати файл)"
        else:
            summary = "(Файл видалено або переміщено)"

        summary = " ".join(summary.split())[:500]
        adr_name = Path(adr_rel).name
        lines.append(f"- **{adr_name}**: {summary}")

    lines.append("")
    return "\n".join(lines)


def build_digest_markdown(repo: Path, window: str) -> str:
    since_arg = WINDOWS[window]
    return "\n---\n\n".join([
        build_adr_delta(repo, since_arg),
        build_briefing(repo, window, since_arg),
        build_spec_diffs(repo, since_arg),
        build_phase_checklist(repo),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--window", choices=["daily", "weekly"], required=True)
    parser.add_argument("--dry-run", action="store_true", help="generate EPUB, do not send")
    parser.add_argument("--no-send", action="store_true", help="alias for --dry-run")
    parser.add_argument("--out-dir", type=Path, default=Path.home() / "projects" / "resume" / "digests")
    args = parser.parse_args()

    repo = args.repo.resolve()
    md_content = build_digest_markdown(repo, args.window)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    md_path = args.out_dir / f"digest-{args.window}-{ts}.md"
    epub_path = args.out_dir / f"digest-{args.window}-{ts}.epub"
    md_path.write_text(md_content)

    project_name = repo.name
    # build_epub() globs *.md in a directory — write to an isolated temp dir
    # so only today's digest is bundled, not every archived digest in out_dir.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        tmp_md = Path(tmp) / "00-digest.md"
        tmp_md.write_text(md_content)
        build_epub(Path(tmp), epub_path, f"SDD Digest — {project_name} — {args.window}", "sdd-kindle-digest", "uk")

    print(f"Generated: {epub_path} ({epub_path.stat().st_size} bytes)")

    if args.dry_run or args.no_send:
        print("--dry-run/--no-send: not sending.")
        return

    result = send_digest(epub_path, subject=f"SDD Digest [{project_name}] {args.window} {ts}")
    if result.sent:
        print(f"Sent. message_id={result.message_id}")
    else:
        print(f"Send FAILED (digest still archived at {epub_path}): {result.error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
