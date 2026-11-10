#!/bin/sh
# KUAL "Durdur": zamanlayıcıyı durdurur (otomatik başlatma kurulu kalır ama
# 'enabled' silindiği için yeniden başlatmada da çalışmaz).
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=stop

rm -f "$ENABLED_FILE"
"$STOP_BIN" maarif >/dev/null 2>&1 || true
PID=$(cat "$RUN_DIR/maarifd.pid" 2>/dev/null || true)
[ -n "$PID" ] && kill "$PID" >/dev/null 2>&1
log_message "durduruldu"
exit 0
