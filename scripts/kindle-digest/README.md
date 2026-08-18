# SDD Kindle Digest

Recurring + one-time telemetry delivery for SDD-scaffolded projects: git activity,
ADR changes, spec drift, arbiter (shadow-mode) verdicts, phase checklist →
Markdown → EPUB → email to a personal Kindle device.

Design doc: see `kindle-digest-design.md` in this repo (or the vydra-swiss-survey
original at `specs/kindle-digest-design.md`) for the full rationale, content
hierarchy, and Chesterton's-Fence distinction between the **recurring digest**
(this tool) and a **one-time onboarding book** (`docs/sdd-book/`, hand-curated
per project, same converter, single run).

## Files

- `kindle_digest.py` — orchestrator. `--repo <path> --window daily|weekly [--dry-run]`.
  Builds ADR delta + master briefing + spec diffs + phase checklist from a
  target repo's git history and `.specify/feature.json`, converts to EPUB,
  sends it. Archives the Markdown + EPUB under `<repo>/docs/digests/` even if
  the send step fails.
- `md_to_epub.py` — generic Markdown-directory → Kindle-compatible EPUB
  converter (`markdown` + `ebooklib`, no Calibre/pandoc). One `.md` file per
  chapter, numeric filename prefix controls order. Used by both the digest
  and any hand-assembled book (e.g. `docs/sdd-book/`).
- `send_digest.py` — Gmail API sender (send-only OAuth scope). `epub_path`,
  `subject`, `--dry-run`. Amazon Send-to-Kindle limit: 25MB attachment.
- `gmail_authorize.py` — one-time interactive OAuth setup. Produces the token
  `send_digest.py` reuses forever (auto-refreshes).

## Setup (once per operator, not per project)

1. Create a Gmail API OAuth client (Desktop app type) in Google Cloud Console,
   download `gmail_client_secret.json`.
2. `pip install -r requirements.txt`
3. Place the secret at `~/.vydra-survey-profiles/gmail_client_secret.json`
   (shared path — deliberately not renamed per-project; this is one
   operator's Gmail → Kindle relationship, reused across every project that
   enables this feature. Renaming would break every already-running cron.)
4. `python3 gmail_authorize.py` once — interactive, prints a URL, paste back
   the redirect `code=`. Produces `~/.vydra-survey-profiles/gmail_token.json`.
5. In `send_digest.py`, confirm `FROM_ADDR`/`TO_ADDR` match your Gmail and
   Kindle "Send to Kindle" approved-sender email.

## Wiring a new project

```
# Daily rollup, 06:00, and weekly review, Friday 16:00
0 6 * * *     cd <this-dir> && python3 kindle_digest.py --repo /path/to/project --window daily  >> digests/cron.log 2>&1
0 16 * * 5    cd <this-dir> && python3 kindle_digest.py --repo /path/to/project --window weekly >> digests/cron.log 2>&1
```

`--repo` just needs `.specify/feature.json`, `docs/adr/`, and a `specs/*/`
tree to exist (standard SDD-scaffolded layout) — no other per-project setup.

## One-time book (not the recurring digest)

Assemble a directory of numbered `.md` chapters (e.g. `docs/sdd-book/`:
overview + all `docs/adr/*.md` except `template.md` + current `specs/*/spec.md`
files), then:

```
python3 md_to_epub.py --source docs/sdd-book --output docs/sdd-book/book.epub \
  --title "<Project> — SDD Book" --author "<Team>" --lang uk
python3 send_digest.py docs/sdd-book/book.epub --subject "<Project> SDD Book — $(date +%F)"
```

Never overwrite `docs/sdd-book/` from a digest run — different output dir,
different identifier namespace (`urn:...-sdd-book:...` vs `urn:...-sdd-digest:...`),
different generation trigger (manual, not cron).
