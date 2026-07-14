#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

STOP_BIN="${STOP_BIN:-stop}"
LOCK_DIR="${MAARIF_LOCK_DIR:-/tmp/maarif.lock}"
PID_FILE="$LOCK_DIR/pid"

rm -f "$ENABLED_FILE"
"$STOP_BIN" maarif >/dev/null 2>&1 || true

PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" >/dev/null 2>&1 || true
fi
log_message "service stopped"

