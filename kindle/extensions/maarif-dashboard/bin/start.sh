#!/bin/sh
set -u

BASE="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="/tmp/maarif-dashboard.pid"
LOG="${MAARIF_LOG:-/mnt/us/maarif-dashboard.log}"

if [ -f "$PIDFILE" ]; then
  OLD_PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    printf '%s already running pid=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$OLD_PID" >> "$LOG"
    "$BASE/bin/show.sh" >/dev/null 2>&1 || true
    exit 0
  fi
fi

if command -v lipc-set-prop >/dev/null 2>&1; then
  lipc-set-prop com.lab126.powerd preventScreenSaver 1 >/dev/null 2>&1 || true
  lipc-set-prop com.lab126.powerd stopSuspend 1 >/dev/null 2>&1 || true
fi

nohup sh -c 'sleep 5; exec "$1"' _ "$BASE/bin/loop.sh" >/dev/null 2>&1 &
PID="$!"
echo "$PID" > "$PIDFILE"
printf '%s started pid=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$PID" >> "$LOG"
