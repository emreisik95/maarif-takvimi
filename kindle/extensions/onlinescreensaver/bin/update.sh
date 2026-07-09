#!/bin/sh
cd "$(dirname "$0")"

if [ -e "config.sh" ]; then
  . ./config.sh
else
  TMPFILE=/tmp/tmp.onlinescreensaver.png
fi

if [ -e "utils.sh" ]; then
  . ./utils.sh
else
  echo "Could not find utils.sh in $(pwd)"
  exit 1
fi

refresh_if_asleep() {
  lipc-get-prop com.lab126.powerd status | grep "Screen Saver" >/dev/null 2>&1 && (
    logger "Updating image on screen"
    eips -f -g "$SCREENSAVERFILE"
  )
}

normalize_screensaver_image() {
  CONVERT=/mnt/us/linkss/bin/convert
  NORMALIZED="${TMPFILE}.normalized.png"

  if [ ! -x "$CONVERT" ]; then
    logger "linkss convert not found, aborting update"
    return 1
  fi

  # Force exact panel geometry so eips paints 1:1 (a larger source would be drawn
  # from the top-left and appear zoomed/cropped on the e-ink).
  if "$CONVERT" "$TMPFILE" -resize "${SCREEN_SIZE:-600x800}!" -background white -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 "PNG8:$NORMALIZED"; then
    mv "$NORMALIZED" "$TMPFILE"
    return 0
  fi

  logger "Could not normalize screensaver image"
  rm -f "$NORMALIZED"
  return 1
}

install_screensaver_file() {
  mkdir -p "$SCREENSAVERFOLDER"
  normalize_screensaver_image || return 1
  rm -f "$SCREENSAVERFOLDER"/*.png
  mv "$TMPFILE" "$SCREENSAVERFILE"
  logger "Screen saver image file updated: $SCREENSAVERFILE"
  refresh_if_asleep
}

HOUR=$(date '+%H')
if [ "$HOUR" = "03" ] && [ -s "$WHITE_IMAGE" ]; then
  cp "$WHITE_IMAGE" "$TMPFILE"
  install_screensaver_file
  exit 0
fi

if [ -z "$IMAGE_URI" ]; then
  logger "No image URL has been set. Please edit config.sh."
  exit 1
fi

if [ 0 -eq $(lipc-get-prop com.lab126.cmd wirelessEnable) ]; then
  logger "WiFi is off, turning it on now"
  lipc-set-prop com.lab126.cmd wirelessEnable 1
  DISABLE_WIFI=1
fi

TIMER=${NETWORK_TIMEOUT}
CONNECTED=0
while [ 0 -eq $CONNECTED ]; do
  /bin/ping -c 1 "$TEST_DOMAIN" >/dev/null 2>&1 && CONNECTED=1
  if [ 0 -eq $CONNECTED ]; then
    TIMER=$(($TIMER - 1))
    if [ 0 -eq $TIMER ]; then
      logger "No internet connection after ${NETWORK_TIMEOUT} seconds, aborting."
      break
    fi
    sleep 1
  fi
done

if [ 1 -eq $CONNECTED ]; then
  if curl -kL "$IMAGE_URI" -o "$TMPFILE"; then
    install_screensaver_file
  else
    logger "Error updating screensaver"
    rm -f "$TMPFILE"
  fi
fi

if [ 1 -eq $DISABLE_WIFI ]; then
  logger "Disabling WiFi"
  lipc-set-prop com.lab126.cmd wirelessEnable 0
fi
