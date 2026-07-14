#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

UPSTART_JOB="${MAARIF_UPSTART_JOB:-/etc/upstart/maarif.conf}"
START_BIN="${START_BIN:-start}"
STOP_BIN="${STOP_BIN:-stop}"

touch "$ENABLED_FILE" || exit 1
if [ -f "$UPSTART_JOB" ]; then
  "$STOP_BIN" maarif >/dev/null 2>&1 || true
  "$START_BIN" maarif >/dev/null 2>&1 || {
    rm -f "$ENABLED_FILE"
    exit 1
  }
else
  nohup /bin/sh "$SCRIPT_DIR/daemon.sh" >/tmp/maarif-daemon.out 2>&1 &
fi
log_message "service started"

