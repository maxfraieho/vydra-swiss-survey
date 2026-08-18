#!/usr/bin/env python3
"""One-time interactive Gmail OAuth authorization (headless-safe).

Run once on dev-184. Prints a URL — open it in YOUR OWN browser (logged
in as tukroschu@gmail.com), approve, then the browser redirects to
http://localhost/?code=... which will fail to load (nothing listens on
your localhost) — that's expected. Copy the `code` value from the
address bar and paste it back here when prompted.

Produces ~/.vydra-survey-profiles/gmail_token.json — after that, sending
never needs interactive auth again (auto-refreshes).
"""
from pathlib import Path
from google_auth_oauthlib.flow import Flow

SECRETS_DIR = Path.home() / ".vydra-survey-profiles"
CLIENT_SECRET = SECRETS_DIR / "gmail_client_secret.json"
TOKEN_PATH = SECRETS_DIR / "gmail_token.json"

# Least-privilege: send-only, cannot read/list/delete mail.
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def main() -> None:
    flow = Flow.from_client_secrets_file(
        str(CLIENT_SECRET),
        scopes=SCOPES,
        redirect_uri="http://localhost",
    )
    auth_url, _ = flow.authorization_url(prompt="consent")

    print("\n1. Open this URL in YOUR browser (logged in as tukroschu@gmail.com):\n")
    print(auth_url)
    print(
        "\n2. Approve. The page will fail to load (localhost, nothing "
        "listening) — that's fine.\n"
        "3. Copy the value of the `code=` parameter from the browser's "
        "address bar.\n"
    )
    code = input("Paste the code here: ").strip()

    flow.fetch_token(code=code)
    creds = flow.credentials

    TOKEN_PATH.write_text(creds.to_json())
    TOKEN_PATH.chmod(0o600)
    print(f"\nSaved: {TOKEN_PATH}")


if __name__ == "__main__":
    main()
