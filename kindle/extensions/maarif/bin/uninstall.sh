#!/bin/sh
# KUAL "Otomatik başlatmayı kaldır": durdurur ve upstart işini siler.
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=uninstall

/bin/sh "$SCRIPT_DIR/stop.sh" || true
if [ -e "$UPSTART_JOB" ]; then
  "$MNTROOT_BIN" rw >/dev/null 2>&1 || { log_message "kök dosya sistemi yazılabilir yapılamadı"; exit 1; }
  rm -f "$UPSTART_JOB"
  "$SYNC_BIN" >/dev/null 2>&1 || true
  "$MNTROOT_BIN" ro >/dev/null 2>&1 || true
fi
log_message "otomatik başlatma kaldırıldı"
exit 0
