#!/usr/bin/env python3
"""Send an EPUB digest to Kindle via Gmail (send-only scope).

Interface per specs/kindle-digest-design.md §5. Standalone — works from
a cron job or an interactive call, needs no live Claude/MCP session.
Uses a pre-authorized token (see gmail_authorize.py, run once).
"""
import argparse
import base64
import mimetypes
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SECRETS_DIR = Path.home() / ".vydra-survey-profiles"
TOKEN_PATH = SECRETS_DIR / "gmail_token.json"

FROM_ADDR = "tukroschu@gmail.com"
TO_ADDR = "tukroschu@kindle.com"
MAX_BYTES = 25 * 1024 * 1024  # Amazon's Send-to-Kindle attachment limit


@dataclass
class SendResult:
    sent: bool
    message_id: str | None = None
    error: str | None = None


def _load_credentials() -> Credentials:
    if not TOKEN_PATH.exists():
        raise FileNotFoundError(
            f"{TOKEN_PATH} missing — run gmail_authorize.py once first."
        )
    creds = Credentials.from_authorized_user_file(
        str(TOKEN_PATH), scopes=["https://www.googleapis.com/auth/gmail.send"]
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
        TOKEN_PATH.chmod(0o600)
    return creds


def send_digest(
    epub_path: Path, subject: str, *, dry_run: bool = False
) -> SendResult:
    epub_path = Path(epub_path)
    if not epub_path.exists():
        return SendResult(sent=False, error=f"{epub_path} does not exist")

    size = epub_path.stat().st_size
    if size > MAX_BYTES:
        return SendResult(
            sent=False,
            error=f"{epub_path} is {size} bytes, exceeds {MAX_BYTES} limit",
        )

    if dry_run:
        print(f"[dry-run] would send {epub_path} ({size} bytes) -> {TO_ADDR}")
        return SendResult(sent=False, error=None)

    try:
        creds = _load_credentials()
    except FileNotFoundError as e:
        return SendResult(sent=False, error=str(e))

    msg = EmailMessage()
    msg["To"] = TO_ADDR
    msg["From"] = FROM_ADDR
    msg["Subject"] = subject
    msg.set_content("")  # Amazon ignores the body; attachment is what matters

    mime_type, _ = mimetypes.guess_type(str(epub_path))
    maintype, subtype = (mime_type or "application/epub+zip").split("/", 1)
    msg.add_attachment(
        epub_path.read_bytes(),
        maintype=maintype,
        subtype=subtype,
        filename=epub_path.name,
    )

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    try:
        service = build("gmail", "v1", credentials=creds)
        result = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw})
            .execute()
        )
        return SendResult(sent=True, message_id=result.get("id"))
    except HttpError as e:
        return SendResult(sent=False, error=f"Gmail API error: {e}")
    except Exception as e:
        return SendResult(sent=False, error=str(e))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("epub_path", type=Path)
    parser.add_argument("--subject", default="SDD Digest")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = send_digest(args.epub_path, args.subject, dry_run=args.dry_run)
    if result.sent:
        print(f"Sent. message_id={result.message_id}")
    elif result.error:
        print(f"FAILED: {result.error}")
        raise SystemExit(1)
    else:
        print("Dry-run, nothing sent.")


if __name__ == "__main__":
    main()
