#!/bin/sh
# Tek yenileme: görseli indir, panele uydur, ekrana koy.
#   refresh.sh auto    -> WHITE_HOUR içindeyse beyaz, değilse takvim (zamanlayıcı)
#   refresh.sh normal  -> her zaman takvim (KUAL "Şimdi güncelle")
#   refresh.sh white   -> beyaz ekran
# Çıkış: 0 = takvim güncellendi, 3 = beyaz kondu, 1 = başarısız, 75 = başka
# yenileme sürüyor.
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=refresh

MODE=${1:-normal}
LOCK_DIR="$RUN_DIR/refresh.lock"
DOWNLOAD_TMP="$RUN_DIR/download.$$.png"
NORMALIZED_TMP="$RUN_DIR/normalized.$$.png"
LOCKED=0
WIFI_WAS_OFF=0

cleanup() {
  rm -f "$DOWNLOAD_TMP" "$NORMALIZED_TMP"
  if [ "$WIFI_WAS_OFF" -eq 1 ]; then
    "$LIPC_SET_BIN" com.lab126.cmd wirelessEnable 0 >/dev/null 2>&1 || true
  fi
  [ "$LOCKED" -eq 1 ] && rm -rf "$LOCK_DIR"
}
trap 'cleanup' 0
trap 'exit 1' HUP INT TERM

fail() {
  log_message "BAŞARISIZ: $*"
  state_set last_error "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S') $*"
  exit 1
}

mkdir -p "$RUN_DIR" "$STATE_DIR" || exit 1

# Aynı anda tek yenileme. Sahibi ölmüşse kilidi devral.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  OWNER=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
  if [ -n "$OWNER" ] && kill -0 "$OWNER" 2>/dev/null; then
    log_message "başka yenileme sürüyor (pid $OWNER); atlandı"
    exit 75
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null || exit 75
fi
LOCKED=1
printf '%s\n' "$$" > "$LOCK_DIR/pid"

userstore_available || { log_message "USB depolama modu; yenileme atlandı"; exit 1; }

if [ "$MODE" = auto ]; then
  if [ -n "$WHITE_HOUR" ] && [ "$(current_hour)" = "$WHITE_HOUR" ]; then MODE=white; else MODE=normal; fi
fi

case "$MODE" in
  white)
    validate_panel_image "$WHITE_IMAGE" || fail "paketteki beyaz görsel bozuk"
    install_display_image "$WHITE_IMAGE" || fail "beyaz görsel konamadı"
    log_message "beyaz ekran penceresi"
    exit 3
    ;;
  normal) ;;
  *) log_message "bilinmeyen kip: $MODE"; exit 2 ;;
esac

# Ağdan önce ekranda mutlaka okunur bir takvim olsun (04:00'te beyazı hemen
# kaldırır, bozuk/eksik hedefi onarır).
ensure_target_has_content || log_message "UYARI: ekrana yedek görsel de konamadı"

# --- Wi-Fi -------------------------------------------------------------------
if [ "$("$LIPC_GET_BIN" com.lab126.cmd wirelessEnable 2>/dev/null)" = 0 ]; then
  WIFI_WAS_OFF=1
fi
"$LIPC_SET_BIN" com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true

WAITED=0
WIFI_STATE=
while [ "$WAITED" -lt "$WIFI_TIMEOUT" ]; do
  WIFI_STATE=$("$LIPC_GET_BIN" com.lab126.wifid cmState 2>/dev/null || true)
  case "$WIFI_STATE" in CONNECTED*) break ;; esac
  "$SLEEP_BIN" 3
  WAITED=$((WAITED + 3))
done
case "$WIFI_STATE" in
  CONNECTED*) log_message "Wi-Fi bağlı (${WAITED}s)" ;;
  *) log_message "Wi-Fi ${WIFI_TIMEOUT}s içinde bağlanmadı (durum: ${WIFI_STATE:-bilinmiyor}); yine de deneniyor" ;;
esac

# --- İndir -------------------------------------------------------------------
# Sunucu loglarında cihazı görebilmek için kaynak ve pil bilgisi eklenir.
case "$IMAGE_URL" in *\?*) SEP='&' ;; *) SEP='?' ;; esac
URL="${IMAGE_URL}${SEP}src=kindle&bat=$(battery_level)"

ATTEMPT=1
while :; do
  rm -f "$DOWNLOAD_TMP"
  if "$CURL_BIN" -f -s -S -L --cacert "$CA_CERT" \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
      -o "$DOWNLOAD_TMP" "$URL" 2>"$RUN_DIR/curl.err" \
     && validate_png_signature "$DOWNLOAD_TMP"; then
    break
  fi
  log_message "indirme denemesi $ATTEMPT/$DOWNLOAD_ATTEMPTS başarısız: $(head -c 200 "$RUN_DIR/curl.err" 2>/dev/null | tr '\n' ' ')"
  [ "$ATTEMPT" -ge "$DOWNLOAD_ATTEMPTS" ] && fail "indirme ($DOWNLOAD_ATTEMPTS deneme)"
  ATTEMPT=$((ATTEMPT + 1))
  "$SLEEP_BIN" "$DOWNLOAD_RETRY_DELAY"
done

# --- Panele uydur ve koy ---------------------------------------------------------
"$CONVERT_BIN" "$DOWNLOAD_TMP" \
  -background white -rotate "$IMAGE_ROTATION" -resize "${SCREEN_SIZE}!" \
  -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 \
  -define png:color-type=0 "$NORMALIZED_TMP" >/dev/null 2>&1 || fail "convert"
validate_panel_image "$NORMALIZED_TMP" content || fail "indirilen görsel geçersiz/boş"

# Ağ beklerken beyaz saate girildiyse takvimi koyma.
if [ "${1:-normal}" = auto ] && [ -n "$WHITE_HOUR" ] && [ "$(current_hour)" = "$WHITE_HOUR" ]; then
  install_display_image "$WHITE_IMAGE" && log_message "beyaz ekran penceresi (indirme sonrası)"
  exit 3
fi

copy_atomic "$NORMALIZED_TMP" "$LAST_GOOD_IMAGE" || fail "son iyi görsel yazılamadı"
install_display_image "$NORMALIZED_TMP" || fail "görsel ekrana konamadı"
state_set last_ok "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S')"
log_message "takvim güncellendi (pil %$(battery_level))"
exit 0
