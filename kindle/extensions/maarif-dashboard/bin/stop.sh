#!/bin/sh
set -u

PIDFILE="/tmp/maarif-dashboard.pid"
LOG="${MAARIF_LOG:-/mnt/us/maarif-dashboard.log}"

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "${PID:-}" ]; then
    kill "$PID" >/dev/null 2>&1 || true
  fi
  rm -f "$PIDFILE"
fi

if command -v lipc-set-prop >/dev/null 2>&1; then
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 >/dev/null 2>&1 || true
  lipc-set-prop com.lab126.powerd stopSuspend 0 >/dev/null 2>&1 || true
fi

/etc/init.d/framework start >/dev/null 2>&1 || true

printf '%s stopped\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
