#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

UPSTART_JOB="${MAARIF_UPSTART_JOB:-/etc/upstart/maarif.conf}"
STATUS_FILE="${MAARIF_STATUS_FILE:-/mnt/us/maarif-status.log}"
STATUS_TMP="${STATUS_FILE}.tmp.$$"
LOCK_DIR="${MAARIF_LOCK_DIR:-/tmp/maarif.lock}"

{
  printf 'Maarif status — %s\n' "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S')"
  printf 'extension=%s\n' "$MAARIF_BASE"
  printf 'enabled=%s\n' "$(if [ -f "$ENABLED_FILE" ]; then printf yes; else printf no; fi)"
  printf 'upstart_job=%s\n' "$(if [ -f "$UPSTART_JOB" ]; then printf installed; else printf missing; fi)"
  printf 'lock=%s\n' "$(if [ -d "$LOCK_DIR" ]; then printf present; else printf missing; fi)"
  printf 'pid=%s\n' "$(cat "$LOCK_DIR/pid" 2>/dev/null || printf none)"
  printf 'mode=%s\n' "$(current_mode 2>/dev/null || printf unknown)"
  printf 'next_boundary_seconds=%s\n' "$(seconds_to_next_boundary 2>/dev/null || printf unknown)"
  printf 'wireless=%s\n' "$("$LIPC_GET_BIN" com.lab126.cmd wirelessEnable 2>/dev/null || printf unknown)"
  printf 'power=%s\n' "$("$LIPC_GET_BIN" com.lab126.powerd status 2>/dev/null || printf unknown)"
  printf '\ntarget: '
  image_metadata "$TARGET_IMAGE" 2>&1 || printf 'invalid or missing'
  printf '\nlast-good: '
  image_metadata "$LAST_GOOD_IMAGE" 2>&1 || printf 'invalid or missing'
  printf '\n\nprocesses:\n'
  ps auxww 2>&1 | grep -E 'maarif|PID' | grep -v grep || true
  printf '\nrecent log:\n'
  tail -n 80 "$LOG_FILE" 2>&1 || true
} > "$STATUS_TMP"

mv "$STATUS_TMP" "$STATUS_FILE"
"$SYNC_BIN" >/dev/null 2>&1 || true
log_message "status written to $STATUS_FILE"

