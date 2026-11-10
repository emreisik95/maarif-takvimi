#!/bin/sh
# Maarif Kindle eklentisi — ortak yardımcılar (busybox ash uyumlu).

# --- Log ---------------------------------------------------------------
log_message() {
  if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || printf '0')
    case "$LOG_SIZE" in *[!0-9]*|'') LOG_SIZE=0 ;; esac
    if [ "$LOG_SIZE" -gt "$LOG_MAX_BYTES" ]; then
      tail -n 1000 "$LOG_FILE" > "$LOG_FILE.trim.$$" 2>/dev/null && mv "$LOG_FILE.trim.$$" "$LOG_FILE"
      rm -f "$LOG_FILE.trim.$$"
    fi
  fi
  printf '%s [%s] %s\n' "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)" "${LOG_TAG:-maarif}" "$*" \
    >> "$LOG_FILE" 2>/dev/null || true
}

# --- Durum dosyaları (state/) ---------------------------------------------
state_get() {
  cat "$STATE_DIR/$1" 2>/dev/null || printf '%s\n' "${2:-}"
}

state_set() {
  mkdir -p "$STATE_DIR" 2>/dev/null || return 1
  printf '%s\n' "$2" > "$STATE_DIR/$1.tmp.$$" && mv "$STATE_DIR/$1.tmp.$$" "$STATE_DIR/$1"
}

# --- Zaman ---------------------------------------------------------------
now_epoch() {
  if [ -n "${MAARIF_NOW_EPOCH:-}" ]; then printf '%s\n' "$MAARIF_NOW_EPOCH"; else "$DATE_BIN" '+%s'; fi
}

# Yerel saat "H M S" (başında sıfır olmadan).
now_hms() {
  if [ -n "${MAARIF_NOW_HMS:-}" ]; then
    HMS_VALUE=$MAARIF_NOW_HMS
  else
    HMS_VALUE=$("$DATE_BIN" '+%H:%M:%S') || return 1
  fi
  printf '%s\n' "$HMS_VALUE" | "$AWK_BIN" -F: '{ printf "%d %d %d\n", $1, $2, $3 }'
}

current_hour() {
  set -- $(now_hms) || return 1
  printf '%s\n' "$1"
}

# Şu andan bir sonraki SCHEDULE anına kalan saniye (1..86400).
seconds_to_next_boundary() {
  set -- $(now_hms) || return 1
  NOW_SOD=$(( $1 * 3600 + $2 * 60 + $3 ))
  printf '%s\n' "$SCHEDULE" | "$AWK_BIN" -v now="$NOW_SOD" '
    {
      for (i = 1; i <= NF; i++) {
        split($i, t, ":"); b = t[1] * 3600 + t[2] * 60
        d = b - now; if (d <= 0) d += 86400
        if (best == "" || d < best) best = d
      }
    }
    END { if (best == "") exit 1; print best }'
}

# --- Kindle durumu -------------------------------------------------------------
userstore_available() {
  USERSTORE_STATE=$("$LIPC_GET_BIN" com.lab126.volumd userstoreIsAvailable 2>/dev/null || true)
  case "$USERSTORE_STATE" in
    0) return 1 ;;
    1) return 0 ;;
  esac
  [ -r "$MAARIF_BASE/bin/config.sh" ]
}

battery_level() {
  BATT=$("$LIPC_GET_BIN" com.lab126.powerd battLevel 2>/dev/null || true)
  case "$BATT" in ''|*[!0-9]*) printf 'na\n' ;; *) printf '%s\n' "$BATT" ;; esac
}

power_status() {
  "$LIPC_GET_BIN" com.lab126.powerd status 2>/dev/null | head -n 1
}

# powerd'a "N saniye sonra uyandır" de. Uykuya girmeden hemen önce de, uyanıkken
# de çağrılabilir; en son çağrı geçerlidir.
arm_rtc() {
  ARM_SECONDS=$1
  [ "$ARM_SECONDS" -lt 30 ] && ARM_SECONDS=30
  if "$LIPC_SET_BIN" -i com.lab126.powerd rtcWakeup "$ARM_SECONDS" >/dev/null 2>&1; then
    return 0
  fi
  log_message "UYARI: rtcWakeup ${ARM_SECONDS}s ayarlanamadı"
  return 1
}

# --- PNG doğrulama -----------------------------------------------------------
validate_png_signature() {
  [ -s "$1" ] || return 1
  [ "$("$OD_BIN" -An -tx1 -N8 "$1" 2>/dev/null | "$TR_BIN" -d ' \n')" = "89504e470d0a1a0a" ]
}

image_metadata() {
  "$IDENTIFY_BIN" -quiet -format '%w %h %z %[colorspace] %[fx:standard_deviation]' "$1" 2>/dev/null
}

# 600x800 8-bit gri PNG mi? $2=content ise boş (tek renk) görseli de reddeder.
validate_panel_image() {
  validate_png_signature "$1" || return 1
  META=$(image_metadata "$1") || return 1
  set -- $META "${2:-}"
  PANEL_W=${SCREEN_SIZE%x*}
  PANEL_H=${SCREEN_SIZE#*x}
  [ "${1:-} ${2:-} ${3:-}" = "$PANEL_W $PANEL_H 8" ] || return 1
  case "${4:-}" in *Gray*) ;; *) return 1 ;; esac
  [ "${6:-}" = content ] || return 0
  "$AWK_BIN" -v v="${5:-0}" -v m="$MIN_STANDARD_DEVIATION" 'BEGIN { exit !(v + 0 > m + 0) }'
}

# --- Ekrana koyma ---------------------------------------------------------------
copy_atomic() {
  mkdir -p "${2%/*}" 2>/dev/null || return 1
  cp "$1" "$2.tmp.$$" || { rm -f "$2.tmp.$$"; return 1; }
  "$SYNC_BIN" >/dev/null 2>&1 || true
  mv "$2.tmp.$$" "$2" || { rm -f "$2.tmp.$$"; return 1; }
  "$SYNC_BIN" >/dev/null 2>&1 || true
}

# Görseli linkss hedefine koy; ekran koruyucu açıksa hemen yeniden çiz.
install_display_image() {
  copy_atomic "$1" "$TARGET_IMAGE" || return 1
  case "$(power_status)" in
    *"Screen Saver"*|*ScreenSaver*)
      "$EIPS_BIN" -f -g "$TARGET_IMAGE" >/dev/null 2>&1 || log_message "eips çizimi başarısız"
      ;;
  esac
  return 0
}

# Ekranda geçerli bir takvim yoksa son iyi görseli (o da yoksa paketteki
# yedeği) koy.
ensure_target_has_content() {
  validate_panel_image "$TARGET_IMAGE" content && return 0
  if validate_panel_image "$LAST_GOOD_IMAGE" content; then
    install_display_image "$LAST_GOOD_IMAGE" && log_message "son iyi görsel geri yüklendi"
    return $?
  fi
  install_display_image "$FALLBACK_IMAGE" && log_message "paketteki yedek görsel kondu"
}
