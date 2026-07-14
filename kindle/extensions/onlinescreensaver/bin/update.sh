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
  ROTATION="${1:-${IMAGE_ROTATION:-0}}"
  CONVERT_BIN="${CONVERT:-/mnt/us/linkss/bin/convert}"
  NORMALIZED="${TMPFILE}.normalized.png"
  TARGET_SIZE="${SCREEN_SIZE:-600x800}"

  if [ ! -x "$CONVERT_BIN" ]; then
    logger "linkss convert not found, aborting update"
    return 1
  fi

  # Preserve aspect ratio, center on the exact panel canvas, and force PNG color
  # type 0. Palette output (type 3) can make this Kindle's eips misread scanlines.
  rm -f "$NORMALIZED"
  if "$CONVERT_BIN" "$TMPFILE" \
    -background white -rotate "$ROTATION" \
    -resize "$TARGET_SIZE" \
    -background white -gravity center -extent "$TARGET_SIZE" \
    -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 \
    -define png:color-type=0 "$NORMALIZED"; then
    mv "$NORMALIZED" "$TMPFILE"
    return 0
  fi

  logger "Could not normalize screensaver image"
  rm -f "$NORMALIZED"
  return 1
}

install_screensaver_file() {
  ROTATION="${1:-${IMAGE_ROTATION:-0}}"
  mkdir -p "$SCREENSAVERFOLDER"
  normalize_screensaver_image "$ROTATION" || return 1
  rm -f "$SCREENSAVERFOLDER"/*.png
  mv "$TMPFILE" "$SCREENSAVERFILE"
  logger "Screen saver image file updated: $SCREENSAVERFILE"
  refresh_if_asleep
}

remember_last_good() {
  [ -s "$SCREENSAVERFILE" ] || return 1
  mkdir -p "$(dirname "$LAST_GOOD_IMAGE")"
  cp "$SCREENSAVERFILE" "$LAST_GOOD_IMAGE" || return 1
  logger "Last-known-good image saved: $LAST_GOOD_IMAGE"
}

restore_last_good() {
  [ -s "$LAST_GOOD_IMAGE" ] || return 1
  cp "$LAST_GOOD_IMAGE" "$TMPFILE" || return 1
  # The backup is copied from the already panel-oriented installed image.
  install_screensaver_file 0 || return 1
  logger "Last-known-good image restored"
}

download_image() {
  ATTEMPT=1
  ATTEMPTS="${DOWNLOAD_ATTEMPTS:-3}"

  while [ "$ATTEMPT" -le "$ATTEMPTS" ]; do
    rm -f "$TMPFILE"
    logger "Downloading image (attempt $ATTEMPT/$ATTEMPTS)"
    if curl -f -k -L \
      --connect-timeout "${CURL_CONNECT_TIMEOUT:-20}" \
      --max-time "${CURL_MAX_TIME:-90}" \
      -o "$TMPFILE" "$IMAGE_URI" && [ -s "$TMPFILE" ]; then
      logger "Image download completed"
      return 0
    fi

    rm -f "$TMPFILE"
    logger "Image download attempt $ATTEMPT failed"
    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -le "$ATTEMPTS" ]; then
      sleep "${DOWNLOAD_RETRY_DELAY:-10}"
    fi
  done

  return 1
}

HOUR=$(date '+%H')
if [ "$HOUR" = "03" ] && [ -s "$WHITE_IMAGE" ]; then
  # Successful normal updates keep this backup fresh. Seed it only for upgrades
  # that do not have one yet; repeated 03:xx wakes must never back up white.
  if [ ! -s "$LAST_GOOD_IMAGE" ]; then
    remember_last_good || logger "Could not seed last-known-good image"
  fi
  cp "$WHITE_IMAGE" "$TMPFILE"
  if install_screensaver_file 0; then
    logger "03:00 white window displayed"
    exit 0
  fi
  exit 1
fi

if [ -z "$IMAGE_URI" ]; then
  logger "No image URL has been set. Please edit config.sh."
  exit 1
fi

RESTORE_WIFI="${DISABLE_WIFI:-0}"
if [ "$(lipc-get-prop com.lab126.cmd wirelessEnable 2>/dev/null)" = "0" ]; then
  logger "WiFi is off, turning it on now"
  lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
  RESTORE_WIFI=1
else
  # Reassert the desired state after an RTC wake; this is idempotent and gives
  # powerd a chance to reassociate before curl's connection timeout expires.
  lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
fi

RECOVERED=0
if [ "$HOUR" = "04" ]; then
  if restore_last_good; then
    RECOVERED=1
    logger "04:00 white window ended before network update"
  fi
fi

UPDATED=0
if download_image; then
  if install_screensaver_file; then
    remember_last_good || logger "Could not refresh last-known-good image"
    UPDATED=1
  else
    logger "Downloaded image could not be installed"
  fi
else
  logger "Image download failed after ${DOWNLOAD_ATTEMPTS:-3} attempts"
fi

if [ "$UPDATED" -eq 0 ] && [ "$RECOVERED" -eq 0 ]; then
  if restore_last_good; then
    RECOVERED=1
  else
    logger "No last-known-good image available"
  fi
fi

if [ "$RESTORE_WIFI" -eq 1 ]; then
  logger "Disabling WiFi"
  lipc-set-prop com.lab126.cmd wirelessEnable 0 >/dev/null 2>&1 || true
fi

[ "$UPDATED" -eq 1 ] || [ "$RECOVERED" -eq 1 ]
