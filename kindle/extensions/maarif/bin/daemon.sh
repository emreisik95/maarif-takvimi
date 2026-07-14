#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

LOCK_DIR="${MAARIF_LOCK_DIR:-/tmp/maarif.lock}"
PID_FILE="$LOCK_DIR/pid"

cleanup_daemon() {
  if [ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK_DIR"
  fi
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log_message "daemon already running as pid $OLD_PID"
    exit 0
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null || exit 1
fi
printf '%s\n' "$$" > "$PID_FILE" || exit 1
trap 'cleanup_daemon' 0 HUP INT TERM

log_message "daemon started pid=$$"
while :; do
  if ! userstore_available; then
    "$SLEEP_BIN" 60
    continue
  fi
  [ -f "$ENABLED_FILE" ] || break

  /bin/sh "$SCRIPT_DIR/refresh.sh" auto || log_message "refresh cycle failed"
  [ -f "$ENABLED_FILE" ] || break

  WAIT_SECONDS=$(/bin/sh "$SCRIPT_DIR/schedule.sh" seconds) || {
    log_message "could not calculate next boundary"
    "$SLEEP_BIN" 60
    continue
  }
  NOW_EPOCH=$("$DATE_BIN" '+%s') || exit 1
  TARGET_EPOCH=$((NOW_EPOCH + WAIT_SECONDS))
  log_message "next wall-clock boundary in ${WAIT_SECONDS}s"
  wait_until_epoch "$TARGET_EPOCH" || {
    log_message "boundary wait failed; retrying in 60s"
    "$SLEEP_BIN" 60
  }
done
log_message "daemon stopped"
