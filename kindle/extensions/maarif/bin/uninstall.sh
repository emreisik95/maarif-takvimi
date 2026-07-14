#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

UPSTART_JOB="${MAARIF_UPSTART_JOB:-/etc/upstart/maarif.conf}"
MNTROOT_BIN="${MNTROOT_BIN:-mntroot}"
STOP_BIN="${STOP_BIN:-stop}"
ROOT_RW=0

remount_ro() {
  if [ "$ROOT_RW" -eq 1 ]; then
    "$MNTROOT_BIN" ro >/dev/null 2>&1 || true
    ROOT_RW=0
  fi
}
trap 'remount_ro' 0
trap 'exit 1' HUP INT TERM

/bin/sh "$SCRIPT_DIR/stop.sh" || true
"$STOP_BIN" maarif >/dev/null 2>&1 || true

if [ -e "$UPSTART_JOB" ]; then
  if ! "$MNTROOT_BIN" rw >/dev/null 2>&1; then
    log_message "could not remount Kindle root read-write"
    exit 1
  fi
  ROOT_RW=1
  rm -f "$UPSTART_JOB" || exit 1
  "$SYNC_BIN" >/dev/null 2>&1 || true
  remount_ro
fi

rm -f "$ENABLED_FILE"
log_message "automatic start removed; extension files preserved"
exit 0
