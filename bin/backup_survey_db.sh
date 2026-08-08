#!/usr/bin/env bash
set -euo pipefail

SRC_DB="${SRC_DB:-${HOME}/.vydra-survey-profiles/survey_graph.db}"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/.vydra-survey-profiles/backups}"
MAX_BACKUPS=10

# 1. Ensure sqlite3 CLI is available
if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "Error: sqlite3 CLI is missing on this system." >&2
    echo "Please install sqlite3 (e.g., 'sudo apt install sqlite3')." >&2
    exit 1
fi

# 2. Check if source database exists
if [ ! -f "$SRC_DB" ]; then
    echo "Source database $SRC_DB does not exist. Nothing to backup."
    exit 0
fi

# 3. Create destination directory
mkdir -p "$BACKUP_DIR"

# 4. Perform safe online backup via sqlite3 CLI
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
DST_DB="${BACKUP_DIR}/survey_graph_${TIMESTAMP}.db"

echo "Creating online backup of $SRC_DB -> $DST_DB"
sqlite3 "$SRC_DB" ".backup '$DST_DB'"

# 5. Verify backup file creation and non-zero size
if [ ! -f "$DST_DB" ] || [ ! -s "$DST_DB" ]; then
    echo "Error: Backup file $DST_DB was not created or is empty." >&2
    exit 1
fi

echo "Backup successful:"
ls -la "$DST_DB"
echo "Backup path: $DST_DB"

# 6. Rotate backups (keep only latest 10 files)
mapfile -t BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "survey_graph_*.db" | sort)
NUM_BACKUPS=${#BACKUPS[@]}

if [ "$NUM_BACKUPS" -gt "$MAX_BACKUPS" ]; then
    NUM_TO_DELETE=$((NUM_BACKUPS - MAX_BACKUPS))
    echo "Rotating backups: keeping last $MAX_BACKUPS, removing $NUM_TO_DELETE old backup(s)..."
    for ((i=0; i<NUM_TO_DELETE; i++)); do
        OLD_BACKUP="${BACKUPS[i]}"
        if [ -n "$OLD_BACKUP" ] && [ -f "$OLD_BACKUP" ]; then
            echo "Removing old backup: $OLD_BACKUP"
            rm -f "$OLD_BACKUP"
        fi
    done
fi
