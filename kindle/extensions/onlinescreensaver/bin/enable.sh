#!/bin/sh
cd "$(dirname "$0")"
. ./config.sh
. ./utils.sh
logger "Starting Maarif lock screen scheduler"
PID="$(ps xa | grep '/bin/sh /mnt/us/extensions/onlinescreensaver/bin/scheduler.sh' | grep -v grep | awk '{print $1}')"
[ -n "$PID" ] && kill $PID >/dev/null 2>&1 || true
touch /mnt/us/extensions/onlinescreensaver/enabled
nohup /bin/sh /mnt/us/extensions/onlinescreensaver/bin/scheduler.sh >/tmp/onlinescreensaver.out 2>&1 &
