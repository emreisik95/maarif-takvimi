#!/bin/sh
# Durum raporu: /mnt/us/maarif-status.txt (USB ile bağlayınca okunur).
#   status.sh        -> rapor + son 80 log satırı
#   status.sh quiet  -> kısa rapor (zamanlayıcı her yenilemeden sonra yazar)
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=status

alive() { [ -n "$1" ] && kill -0 "$1" 2>/dev/null && printf 'çalışıyor (pid %s)' "$1" || printf 'YOK'; }

DUE=$(state_get next_due 0)
NOW=$(now_epoch)
case "$DUE" in ''|*[!0-9]*) DUE=0 ;; esac

{
  printf 'Maarif durum — %s\n\n' "$("$DATE_BIN" '+%Y-%m-%d %H:%M:%S')"
  printf 'etkin             : %s\n' "$([ -f "$ENABLED_FILE" ] && printf evet || printf HAYIR)"
  printf 'otomatik başlatma : %s\n' "$([ -f "$UPSTART_JOB" ] && printf kurulu || printf 'KURULU DEĞİL')"
  printf 'zamanlayıcı       : %s\n' "$(alive "$(cat "$RUN_DIR/maarifd.pid" 2>/dev/null)")"
  printf 'son başarılı      : %s\n' "$(state_get last_ok yok)"
  printf 'son hata          : %s\n' "$(state_get last_error yok)"
  printf 'art arda hata     : %s\n' "$(state_get fails 0)"
  printf 'sonraki yenileme  : %ss sonra\n' "$((DUE - NOW))"
  printf 'pil               : %%%s\n' "$(battery_level)"
  printf 'güç durumu        : %s\n' "$(power_status)"
  printf 'Wi-Fi             : açık=%s durum=%s\n' \
    "$("$LIPC_GET_BIN" com.lab126.cmd wirelessEnable 2>/dev/null)" \
    "$("$LIPC_GET_BIN" com.lab126.wifid cmState 2>/dev/null)"
  printf 'görsel adresi     : %s\n' "$IMAGE_URL"
  if [ "${1:-}" != quiet ]; then
    printf '\nekrandaki görsel  : %s\n' "$(image_metadata "$TARGET_IMAGE" || printf 'geçersiz/yok')"
    printf 'son iyi görsel    : %s\n' "$(image_metadata "$LAST_GOOD_IMAGE" || printf 'geçersiz/yok')"
    printf '\nsüreçler:\n'
    ps 2>/dev/null | grep -E 'maarif|refresh|lipc-wait' | grep -v grep
    printf '\nson log:\n'
    tail -n 80 "$LOG_FILE" 2>/dev/null
  fi
} > "$STATUS_FILE.tmp.$$" 2>&1
mv "$STATUS_FILE.tmp.$$" "$STATUS_FILE"
"$SYNC_BIN" >/dev/null 2>&1 || true
