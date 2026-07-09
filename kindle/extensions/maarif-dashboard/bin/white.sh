#!/bin/sh
set -u

LOG="${MAARIF_LOG:-/mnt/us/maarif-dashboard.log}"

printf '%s white screen\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"

if command -v eips >/dev/null 2>&1; then
  eips -c >/dev/null 2>&1 || true
  eips -f -c >/dev/null 2>&1 || true
else
  printf '%s eips not found\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
  exit 2
fi
