#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

UPSTART_JOB="${MAARIF_UPSTART_JOB:-/etc/upstart/maarif.conf}"
MNTROOT_BIN="${MNTROOT_BIN:-mntroot}"
START_BIN="${START_BIN:-start}"
STOP_BIN="${STOP_BIN:-stop}"
ROOT_RW=0
JOB_TMP="${UPSTART_JOB}.tmp.$$"

remount_ro() {
  rm -f "$JOB_TMP" 2>/dev/null || true
  if [ "$ROOT_RW" -eq 1 ]; then
    "$MNTROOT_BIN" ro >/dev/null 2>&1 || true
    ROOT_RW=0
  fi
}
trap 'remount_ro' 0 HUP INT TERM

rollback_installed_job() {
  if "$MNTROOT_BIN" rw >/dev/null 2>&1; then
    ROOT_RW=1
    rm -f "$UPSTART_JOB" || true
    "$SYNC_BIN" >/dev/null 2>&1 || true
    remount_ro
  else
    log_message "could not remount root to roll back failed service"
  fi
}

stop_legacy_schedulers() {
  for LEGACY_PATTERN in 'onlinescreensaver/bin/scheduler.sh' 'maarif-dashboard/bin/loop.sh'; do
    LEGACY_PIDS=$(ps xa 2>/dev/null | grep "$LEGACY_PATTERN" | grep -v grep | "$AWK_BIN" '{print $1}')
    for LEGACY_PID in $LEGACY_PIDS; do
      [ "$LEGACY_PID" = "$$" ] || kill "$LEGACY_PID" >/dev/null 2>&1 || true
    done
  done
}

mkdir -p "$STATE_DIR" || exit 1
ensure_verified_last_good || {
  log_message "packaged fallback is invalid; refusing to install"
  exit 1
}

UPSTART_DIR=${UPSTART_JOB%/*}
if [ ! -d "$UPSTART_DIR" ]; then
  log_message "upstart directory is missing: $UPSTART_DIR"
  exit 1
fi

if ! "$MNTROOT_BIN" rw >/dev/null 2>&1; then
  log_message "could not remount Kindle root read-write"
  exit 1
fi
ROOT_RW=1

rm -f "$JOB_TMP"
if ! cp "$SCRIPT_DIR/maarif.conf" "$JOB_TMP"; then
  log_message "could not stage upstart job"
  exit 1
fi
chmod 644 "$JOB_TMP" || exit 1
if ! mv "$JOB_TMP" "$UPSTART_JOB"; then
  log_message "could not install upstart job"
  exit 1
fi
"$SYNC_BIN" >/dev/null 2>&1 || true
remount_ro
touch "$ENABLED_FILE" || exit 1

"$STOP_BIN" maarif >/dev/null 2>&1 || true
if ! "$START_BIN" maarif >/dev/null 2>&1; then
  rm -f "$ENABLED_FILE"
  rollback_installed_job
  log_message "upstart job installed but could not be started"
  exit 1
fi
stop_legacy_schedulers
log_message "installed and started reboot-persistent Maarif service"
exit 0
