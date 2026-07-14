#!/bin/sh
cd "$(dirname "$0")" || exit 1
. ./config.sh

STATUS_FILE=/mnt/us/maarif-status.txt

case "$IMAGE_URI" in
  */auto.png) LAYOUT="automatic" ;;
  */date-focus.png) LAYOUT="large date" ;;
  */agenda-focus.png) LAYOUT="agenda focus" ;;
  *) LAYOUT="$IMAGE_URI" ;;
esac

case "${IMAGE_ROTATION:-0}" in
  90) ORIENTATION="power button right" ;;
  -90) ORIENTATION="power button left" ;;
  *) ORIENTATION="portrait / no rotation" ;;
esac

PID="$(ps xa | grep '/bin/sh /mnt/us/extensions/onlinescreensaver/bin/scheduler.sh' | grep -v grep | awk '{print $1}')"
if [ -n "$PID" ]; then
  SERVICE="running (pid $PID)"
else
  SERVICE="stopped"
fi

{
  echo "=== Maarif Lock Screen status $(date) ==="
  echo "service=$SERVICE"
  echo "layout=$LAYOUT"
  echo "orientation=$ORIENTATION"
  echo "default_interval_minutes=$DEFAULTINTERVAL"
  echo "schedule=$SCHEDULE"
  echo "image_uri=$IMAGE_URI"
  echo "download_attempts=${DOWNLOAD_ATTEMPTS:-3}"
  echo
  echo "Installed image:"
  /mnt/us/linkss/bin/identify "$SCREENSAVERFILE" 2>&1
  echo
  echo "Last-known-good image:"
  /mnt/us/linkss/bin/identify "$LAST_GOOD_IMAGE" 2>&1
  echo
  echo "Recent log:"
  tail -n 30 "$LOGFILE" 2>&1
} > "$STATUS_FILE" 2>&1

command -v eips >/dev/null 2>&1 && eips 0 38 "Maarif status written" >/dev/null 2>&1 || true
