#!/bin/sh
cd "$(dirname "$0")"

LOGFILE=/mnt/us/onlinescreensaver.log

log() {
  printf '%s %s\n' "$(date)" "$*" >> "$LOGFILE"
}

log "Resetting sleep blockers"

PID="$(ps xa | grep '/extensions/maarif-dashboard/bin/loop.sh' | grep -v grep | awk '{print $1}')"
[ -n "$PID" ] && kill $PID >/dev/null 2>&1 || true

PID="$(ps xa | grep '/extensions/maarif-dashboard/bin/show.sh' | grep -v grep | awk '{print $1}')"
[ -n "$PID" ] && kill $PID >/dev/null 2>&1 || true

rm -f /tmp/maarif-dashboard.pid

if command -v lipc-set-prop >/dev/null 2>&1; then
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 >/dev/null 2>&1 || true
  lipc-set-prop com.lab126.powerd stopSuspend 0 >/dev/null 2>&1 || true
fi

if command -v powerd_test >/dev/null 2>&1; then
  powerd_test -p >/dev/null 2>&1 || true
fi

log "Sleep blockers reset"
