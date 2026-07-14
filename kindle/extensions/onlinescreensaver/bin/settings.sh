#!/bin/sh
cd "$(dirname "$0")" || exit 1

CONFIG=./config.sh
TMP_CONFIG="/tmp/maarif-config.$$.tmp"
BASE_URL=https://maarif-takvimi.external.emre.zip

cleanup() {
  rm -f "$TMP_CONFIG"
}
trap cleanup EXIT HUP INT TERM

set_config() {
  KEY="$1"
  VALUE="$2"
  sed "s|^${KEY}=.*|${KEY}=${VALUE}|" "$CONFIG" > "$TMP_CONFIG" || return 1
  grep -q "^${KEY}=" "$TMP_CONFIG" || return 1
  mv "$TMP_CONFIG" "$CONFIG"
}

set_interval() {
  MINUTES="$1"
  set_config DEFAULTINTERVAL "$MINUTES" || return 1
  set_config SCHEDULE "\"00:00-03:00=60 03:00-04:00=60 04:00-24:00=${MINUTES}\"" || return 1
}

SETTING="${1:-}"
MESSAGE=""
RESTART=0

case "$SETTING" in
  interval_60)
    set_interval 60 || exit 1
    MESSAGE="Refresh interval: 1 hour"
    RESTART=1
    ;;
  interval_180)
    set_interval 180 || exit 1
    MESSAGE="Refresh interval: 3 hours"
    RESTART=1
    ;;
  interval_360)
    set_interval 360 || exit 1
    MESSAGE="Refresh interval: 6 hours"
    RESTART=1
    ;;
  layout_auto)
    set_config IMAGE_URI "\"${BASE_URL}/image-landscape/auto.png\"" || exit 1
    MESSAGE="Layout: automatic"
    ;;
  layout_date)
    set_config IMAGE_URI "\"${BASE_URL}/image-landscape/date-focus.png\"" || exit 1
    MESSAGE="Layout: large date"
    ;;
  layout_agenda)
    set_config IMAGE_URI "\"${BASE_URL}/image-landscape/agenda-focus.png\"" || exit 1
    MESSAGE="Layout: agenda focus"
    ;;
  orientation_right)
    set_config IMAGE_ROTATION 90 || exit 1
    MESSAGE="Orientation: power button right"
    ;;
  orientation_left)
    set_config IMAGE_ROTATION -90 || exit 1
    MESSAGE="Orientation: power button left"
    ;;
  *)
    exit 2
    ;;
esac

. ./config.sh
. ./utils.sh
logger "KUAL setting changed: $MESSAGE"

if [ "$RESTART" -eq 1 ] && [ -e ../enabled ]; then
  sh ./enable.sh
fi

command -v eips >/dev/null 2>&1 && eips 0 39 "$MESSAGE" >/dev/null 2>&1 || true
exit 0
