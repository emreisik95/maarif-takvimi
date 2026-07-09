#!/bin/sh
cd "$(dirname "$0")"
. ./config.sh
. ./utils.sh
logger "Stopping Maarif lock screen scheduler"
PID="$(ps xa | grep '/bin/sh /mnt/us/extensions/onlinescreensaver/bin/scheduler.sh' | grep -v grep | awk '{print $1}')"
[ -n "$PID" ] && kill $PID >/dev/null 2>&1 || true
rm -f /mnt/us/extensions/onlinescreensaver/enabled
