#!/bin/sh

rotate_log_if_needed() {
  [ -f "$LOG_FILE" ] || return 0
  LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || printf '0')
  case "$LOG_SIZE" in *[!0-9]*|'') LOG_SIZE=0 ;; esac
  [ "$LOG_SIZE" -le "$LOG_MAX_BYTES" ] && return 0

  LOG_TRIMMED="${LOG_FILE}.trimmed.$$"
  tail -n 500 "$LOG_FILE" > "$LOG_TRIMMED" 2>/dev/null && mv "$LOG_TRIMMED" "$LOG_FILE"
  rm -f "$LOG_TRIMMED"
}

log_message() {
  rotate_log_if_needed
  LOG_PARENT=${LOG_FILE%/*}
  [ "$LOG_PARENT" = "$LOG_FILE" ] || mkdir -p "$LOG_PARENT" 2>/dev/null
  printf '%s %s\n' "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

now_hms() {
  if [ -n "${MAARIF_NOW:-}" ]; then
    printf '%s\n' "$MAARIF_NOW"
  else
    "$DATE_BIN" '+%H:%M:%S'
  fi
}

split_now() {
  NOW_VALUE=$(now_hms) || return 1
  OLD_IFS=$IFS
  IFS=:
  set -- $NOW_VALUE
  IFS=$OLD_IFS
  NOW_HOUR=${1:-0}
  NOW_MINUTE=${2:-0}
  NOW_SECOND=${3:-0}
  NOW_HOUR=${NOW_HOUR#0}; NOW_MINUTE=${NOW_MINUTE#0}; NOW_SECOND=${NOW_SECOND#0}
  [ -n "$NOW_HOUR" ] || NOW_HOUR=0
  [ -n "$NOW_MINUTE" ] || NOW_MINUTE=0
  [ -n "$NOW_SECOND" ] || NOW_SECOND=0
}

current_mode() {
  split_now || return 1
  if [ "$NOW_HOUR" -eq 3 ]; then
    printf 'white\n'
  else
    printf 'normal\n'
  fi
}

seconds_to_next_boundary() {
  split_now || return 1
  NOW_SECONDS=$((NOW_HOUR * 3600 + NOW_MINUTE * 60 + NOW_SECOND))
  for BOUNDARY in 3600 10800 14400 25200 36000 46800 57600 68400 79200 90000; do
    if [ "$BOUNDARY" -gt "$NOW_SECONDS" ]; then
      printf '%s\n' "$((BOUNDARY - NOW_SECONDS))"
      return 0
    fi
  done
  return 1
}

userstore_available() {
  USERSTORE_STATE=$("$LIPC_GET_BIN" com.lab126.volumd userstoreIsAvailable 2>/dev/null || true)
  case "$USERSTORE_STATE" in
    0) return 1 ;;
    1) return 0 ;;
  esac

  # Older firmware may not expose the volumd property. In that case, require
  # the normal FUSE path rather than ever writing through /mnt/base-us while
  # USB mass storage is exported to a computer.
  [ -d "$MAARIF_BASE" ] && [ -r "$MAARIF_BASE/bin/config.sh" ]
}

png_signature() {
  [ -s "$1" ] || return 1
  "$OD_BIN" -An -tx1 -N8 "$1" 2>/dev/null | "$TR_BIN" -d ' \n'
}

validate_png_signature() {
  [ "$(png_signature "$1")" = "89504e470d0a1a0a" ]
}

image_metadata() {
  "$IDENTIFY_BIN" -quiet -format '%w %h %z %[colorspace] %[type] %[fx:standard_deviation]' "$1" 2>/dev/null
}

validate_panel_image() {
  IMAGE_TO_CHECK=$1
  validate_png_signature "$IMAGE_TO_CHECK" || return 1
  META=$(image_metadata "$IMAGE_TO_CHECK") || return 1
  set -- $META
  [ "${1:-} ${2:-} ${3:-}" = "600 800 8" ] || return 1
  case "${4:-} ${5:-}" in
    *Gray*|*Grayscale*) return 0 ;;
  esac
  return 1
}

validate_normal_image() {
  IMAGE_TO_CHECK=$1
  validate_panel_image "$IMAGE_TO_CHECK" || return 1
  META=$(image_metadata "$IMAGE_TO_CHECK") || return 1
  set -- $META
  STANDARD_DEVIATION=${6:-0}
  "$AWK_BIN" -v value="$STANDARD_DEVIATION" -v minimum="$MIN_STANDARD_DEVIATION" \
    'BEGIN { exit !(value + 0 > minimum + 0) }'
}

refresh_screen_if_asleep() {
  POWER_STATUS=$("$LIPC_GET_BIN" com.lab126.powerd status 2>/dev/null || true)
  case "$POWER_STATUS" in
    *"Screen Saver"*|*ScreenSaver*)
      "$EIPS_BIN" -f -g "$TARGET_IMAGE" >/dev/null 2>&1 || log_message "screen refresh failed"
      ;;
  esac
}

install_display_image() {
  SOURCE_IMAGE=$1
  DESCRIPTION=$2
  TARGET_PARENT=${TARGET_IMAGE%/*}
  TARGET_TMP="${TARGET_IMAGE}.tmp.$$"
  mkdir -p "$TARGET_PARENT" || return 1
  rm -f "$TARGET_TMP"
  cp "$SOURCE_IMAGE" "$TARGET_TMP" || return 1
  "$SYNC_BIN" >/dev/null 2>&1 || true
  mv "$TARGET_TMP" "$TARGET_IMAGE" || return 1
  "$SYNC_BIN" >/dev/null 2>&1 || true
  log_message "$DESCRIPTION installed"
  refresh_screen_if_asleep
}

seed_last_good_from() {
  SOURCE_IMAGE=$1
  validate_normal_image "$SOURCE_IMAGE" || return 1
  mkdir -p "$STATE_DIR" || return 1
  LAST_TMP="${LAST_GOOD_IMAGE}.seed.$$"
  rm -f "$LAST_TMP"
  cp "$SOURCE_IMAGE" "$LAST_TMP" || return 1
  "$SYNC_BIN" >/dev/null 2>&1 || true
  mv "$LAST_TMP" "$LAST_GOOD_IMAGE" || return 1
  "$SYNC_BIN" >/dev/null 2>&1 || true
}

ensure_verified_last_good() {
  validate_normal_image "$LAST_GOOD_IMAGE" && return 0
  if validate_normal_image "$TARGET_IMAGE"; then
    seed_last_good_from "$TARGET_IMAGE" && log_message "seeded last-good from current target"
    return $?
  fi
  seed_last_good_from "$FALLBACK_IMAGE" && log_message "replaced invalid last-good with fallback"
}

restore_last_good() {
  ensure_verified_last_good || return 1
  install_display_image "$LAST_GOOD_IMAGE" "restored last-good"
}

normalize_image() {
  INPUT_IMAGE=$1
  OUTPUT_IMAGE=$2
  rm -f "$OUTPUT_IMAGE"
  "$CONVERT_BIN" "$INPUT_IMAGE" \
    -background white -rotate "$IMAGE_ROTATION" \
    -resize "${SCREEN_SIZE}!" \
    -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 \
    -define png:color-type=0 "$OUTPUT_IMAGE" >/dev/null 2>&1 || return 1
  validate_normal_image "$OUTPUT_IMAGE"
}

wait_for_wifi_connection() {
  WIFI_WAITED=0
  WIFI_UNKNOWN_WAITED=0

  while [ "$WIFI_WAITED" -lt "$WIFI_CONNECT_TIMEOUT" ]; do
    WIFI_CONNECTION_STATE=$("$LIPC_GET_BIN" com.lab126.wifid cmState 2>/dev/null || true)
    case "$WIFI_CONNECTION_STATE" in
      CONNECTED*)
        log_message "Wi-Fi connected after ${WIFI_WAITED}s"
        return 0
        ;;
      ''|0)
        if [ "$WIFI_UNKNOWN_WAITED" -ge "$WIFI_UNKNOWN_WARMUP" ]; then
          log_message "wifid connection state unavailable; trying download after ${WIFI_WAITED}s"
          return 0
        fi
        WIFI_UNKNOWN_WAITED=$((WIFI_UNKNOWN_WAITED + WIFI_POLL_INTERVAL))
        ;;
      *)
        WIFI_UNKNOWN_WAITED=0
        ;;
    esac

    "$SLEEP_BIN" "$WIFI_POLL_INTERVAL"
    WIFI_WAITED=$((WIFI_WAITED + WIFI_POLL_INTERVAL))
  done

  log_message "Wi-Fi not connected after ${WIFI_CONNECT_TIMEOUT}s; trying download"
  return 0
}

wait_until_epoch() {
  WAIT_TARGET=$1
  WAIT_LAST_NOW=
  while :; do
    WAIT_NOW=$("$DATE_BIN" '+%s') || return 1
    if [ -n "$WAIT_LAST_NOW" ] && [ "$WAIT_NOW" -lt "$WAIT_LAST_NOW" ]; then
      WAIT_RECALCULATED=$(seconds_to_next_boundary) || return 1
      WAIT_TARGET=$((WAIT_NOW + WAIT_RECALCULATED))
      log_message "clock moved backward; boundary recomputed in ${WAIT_RECALCULATED}s"
    fi
    WAIT_LAST_NOW=$WAIT_NOW
    WAIT_REMAINING=$((WAIT_TARGET - WAIT_NOW))
    [ "$WAIT_REMAINING" -gt 0 ] || return 0

    if WAIT_EVENT=$("$LIPC_WAIT_BIN" -s "$WAIT_REMAINING" com.lab126.powerd \
      readyToSuspend,wakeupFromSuspend,resuming 2>/dev/null); then
      log_message "power event: $WAIT_EVENT; remaining=${WAIT_REMAINING}s"
      case "$WAIT_EVENT" in
        readyToSuspend*)
          "$LIPC_SET_BIN" -i com.lab126.powerd rtcWakeup "$WAIT_REMAINING" >/dev/null 2>&1 || \
            log_message "rtcWakeup failed"
          ;;
      esac
    else
      WAIT_AFTER_EVENT=$("$DATE_BIN" '+%s') || return 1
      WAIT_FALLBACK_REMAINING=$((WAIT_TARGET - WAIT_AFTER_EVENT))
      if [ "$WAIT_FALLBACK_REMAINING" -gt 0 ]; then
        "$SLEEP_BIN" "$WAIT_FALLBACK_REMAINING"
      fi
    fi
  done
}
