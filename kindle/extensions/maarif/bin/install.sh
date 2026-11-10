#!/bin/sh
# KUAL "Kur ve başlat": upstart işini kurar (yeniden başlatmada da çalışır),
# eski sürümleri temizler ve zamanlayıcıyı başlatır.
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=install

ROOT_RW=0
remount_ro() {
  rm -f "$UPSTART_JOB.tmp.$$" 2>/dev/null
  if [ "$ROOT_RW" -eq 1 ]; then
    "$MNTROOT_BIN" ro >/dev/null 2>&1 || true
    ROOT_RW=0
  fi
}
trap 'remount_ro' 0
trap 'exit 1' HUP INT TERM

fail() { log_message "KURULUM BAŞARISIZ: $*"; exit 1; }

log_message "kurulum başlıyor"

# 1) Eski zamanlayıcıları durdur (aynı adlı eski 'maarif' işi dahil).
"$STOP_BIN" maarif >/dev/null 2>&1 || true
for JOB in onlinescreensaver maarif-dashboard; do "$STOP_BIN" "$JOB" >/dev/null 2>&1 || true; done
for PATTERN in 'maarif/bin/daemon.sh' 'maarif/bin/maarifd.sh' 'onlinescreensaver/bin/scheduler.sh' 'maarif-dashboard/bin/loop.sh'; do
  for PID in $(ps 2>/dev/null | grep "$PATTERN" | grep -v grep | "$AWK_BIN" '{print $1}'); do
    [ "$PID" = "$$" ] || kill "$PID" >/dev/null 2>&1 || true
  done
done
rm -rf "${MAARIF_LEGACY_TMP:-/tmp}/maarif.lock" "${MAARIF_LEGACY_TMP:-/tmp}/maarif-dashboard.pid" "$RUN_DIR"
"$LIPC_SET_BIN" com.lab126.powerd preventScreenSaver 0 >/dev/null 2>&1 || true

# 2) Upstart işini kur, eskileri kaldır.
[ -d "${UPSTART_JOB%/*}" ] || fail "upstart klasörü yok: ${UPSTART_JOB%/*}"
"$MNTROOT_BIN" rw >/dev/null 2>&1 || fail "kök dosya sistemi yazılabilir yapılamadı"
ROOT_RW=1
cp "$SCRIPT_DIR/maarif.conf" "$UPSTART_JOB.tmp.$$" || fail "upstart işi kopyalanamadı"
chmod 644 "$UPSTART_JOB.tmp.$$"
mv "$UPSTART_JOB.tmp.$$" "$UPSTART_JOB" || fail "upstart işi yazılamadı"
rm -f "${UPSTART_JOB%/*}/onlinescreensaver.conf" "${UPSTART_JOB%/*}/maarif-dashboard.conf"
"$SYNC_BIN" >/dev/null 2>&1 || true
remount_ro

# 3) Ekranda okunur bir takvim olduğundan emin ol, sonra başlat.
mkdir -p "$STATE_DIR"
rm -f "$STATE_DIR/fails" "$STATE_DIR/next_due"
ensure_target_has_content || log_message "UYARI: ekrana yedek görsel konamadı"
touch "$ENABLED_FILE" || fail "enabled dosyası yazılamadı"
if ! "$START_BIN" maarif >/dev/null 2>&1; then
  rm -f "$ENABLED_FILE"
  fail "upstart işi başlatılamadı"
fi
log_message "kuruldu ve başlatıldı"
exit 0
