#!/bin/sh
set -u

BASE="$(cd "$(dirname "$0")/.." && pwd)"
REFRESH_SECONDS="${MAARIF_REFRESH_SECONDS:-10800}"
LOG="${MAARIF_LOG:-/mnt/us/maarif-dashboard.log}"

printf '%s loop start, refresh=%ss\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$REFRESH_SECONDS" >> "$LOG"

while true; do
  HOUR="$(date '+%H')"
  if [ "$HOUR" = "03" ]; then
    "$BASE/bin/white.sh" >> "$LOG" 2>&1 || true
  else
    "$BASE/bin/show.sh" >> "$LOG" 2>&1 || true
  fi
  sleep "$REFRESH_SECONDS"
done
