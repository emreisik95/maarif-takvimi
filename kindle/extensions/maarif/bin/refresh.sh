#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

mkdir -p "$STATE_DIR" || exit 1
DOWNLOAD_TMP="$STATE_DIR/download.$$.png"
NORMALIZED_TMP="$STATE_DIR/normalized.$$.png"
LAST_GOOD_TMP="${LAST_GOOD_IMAGE}.tmp.$$"
TARGET_TMP="${TARGET_IMAGE}.tmp.$$"
WIFI_WAS_OFF=0

cleanup_refresh() {
  rm -f "$DOWNLOAD_TMP" "$NORMALIZED_TMP" "$LAST_GOOD_TMP" "$TARGET_TMP"
  if [ "$WIFI_WAS_OFF" -eq 1 ]; then
    "$LIPC_SET_BIN" com.lab126.cmd wirelessEnable 0 >/dev/null 2>&1 || true
    WIFI_WAS_OFF=0
  fi
}
trap 'cleanup_refresh' 0 HUP INT TERM

requested_mode=${1:-auto}
if [ "$requested_mode" = auto ]; then
  requested_mode=$(current_mode) || exit 1
fi

if [ "$requested_mode" = white ]; then
  validate_panel_image "$WHITE_IMAGE" || {
    log_message "packaged white image is invalid"
    exit 1
  }
  install_display_image "$WHITE_IMAGE" "03:00 white window"
  exit $?
fi

if [ "$requested_mode" != normal ]; then
  log_message "invalid refresh mode: $requested_mode"
  exit 2
fi

# Restore a non-blank image before networking. This makes 04:00 end the white
# window immediately and also repairs a missing or invalid linkss target.
if ! validate_normal_image "$TARGET_IMAGE"; then
  restore_last_good || {
    log_message "no verified offline image available"
    exit 1
  }
fi

# Keep the offline copy healthy even when the currently installed target came
# from an older extension version.
ensure_verified_last_good || log_message "could not seed last-good"

WIRELESS_STATE=$("$LIPC_GET_BIN" com.lab126.cmd wirelessEnable 2>/dev/null || printf '1')
if [ "$WIRELESS_STATE" = 0 ]; then
  WIFI_WAS_OFF=1
  log_message "Wi-Fi was off; enabling temporarily"
  "$LIPC_SET_BIN" com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
  "$SLEEP_BIN" 2
fi

ATTEMPT=1
DOWNLOADED=0
while [ "$ATTEMPT" -le "$DOWNLOAD_ATTEMPTS" ]; do
  rm -f "$DOWNLOAD_TMP"
  log_message "download attempt $ATTEMPT/$DOWNLOAD_ATTEMPTS"
  if "$CURL_BIN" -f -k -L --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
    -o "$DOWNLOAD_TMP" "$IMAGE_URL" && validate_png_signature "$DOWNLOAD_TMP"; then
    DOWNLOADED=1
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  [ "$ATTEMPT" -le "$DOWNLOAD_ATTEMPTS" ] && "$SLEEP_BIN" "$DOWNLOAD_RETRY_DELAY"
done

if [ "$DOWNLOADED" -ne 1 ]; then
  log_message "download failed; keeping verified offline image"
  exit 0
fi

if ! normalize_image "$DOWNLOAD_TMP" "$NORMALIZED_TMP"; then
  log_message "downloaded image validation or normalization failed"
  exit 0
fi

TARGET_PARENT=${TARGET_IMAGE%/*}
mkdir -p "$TARGET_PARENT" "$STATE_DIR" || exit 1
cp "$NORMALIZED_TMP" "$LAST_GOOD_TMP" || exit 1
cp "$NORMALIZED_TMP" "$TARGET_TMP" || exit 1
"$SYNC_BIN" >/dev/null 2>&1 || true
mv "$LAST_GOOD_TMP" "$LAST_GOOD_IMAGE" || exit 1
mv "$TARGET_TMP" "$TARGET_IMAGE" || exit 1
log_message "fresh image committed to target and last-good"
refresh_screen_if_asleep
exit 0

