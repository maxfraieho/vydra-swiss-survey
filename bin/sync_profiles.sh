#!/data/data/com.termux/files/usr/bin/bash
# Pulls persona prompts + site credentials from the dev server's
# exodus-infra/profile/ into a local cache on the phone. Nothing here
# is ever committed to this repo (see .gitignore / PII policy — Q keeps
# these files exclusively at exodus-infra/profile on 192.168.3.184).
set -euo pipefail

DEV_HOST="192.168.3.184"
DEV_USER="vokov"
DEV_PASS="805235io."
REMOTE_DIR="/home/vokov/projects/exodus-infra/profile"
LOCAL_DIR="$HOME/.vydra-survey-profiles"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

# One scp invocation per remote file, not a single multi-source batch:
# sshpass's multi-source scp handling on this device reproducibly
# transfers the first file then reports exit 5 (its "wrong password"
# code) on the rest, even though the password is correct and each file
# transfers fine on its own - a real sshpass/scp interaction bug, not a
# credentials problem. Discovered 2026-07-27.
for f in "опитування.txt" "Лена-опитування.txt" "credentials.json"; do
  sshpass -p "$DEV_PASS" scp -o StrictHostKeyChecking=no \
    "$DEV_USER@$DEV_HOST:$REMOTE_DIR/$f" \
    "$LOCAL_DIR/"
done

chmod 600 "$LOCAL_DIR"/*
echo "Synced profiles + credentials into $LOCAL_DIR"
