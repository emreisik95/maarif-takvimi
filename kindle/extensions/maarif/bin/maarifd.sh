#!/bin/sh
# Maarif zamanlayıcısı (upstart altında ön planda çalışır).
#
# İki parça:
#  1) Uyku dinleyicisi (arka plan): powerd her "readyToSuspend" yayınladığında
#     bir sonraki yenilemeye kalan süreyi rtcWakeup ile kurar. Yenileme
#     sürerken bile çalışır — eski sürümde yenileme sırasında gelen uyku
#     sinyali kaçıyor, alarm kurulmuyor ve Kindle günlerce uyuyordu.
#  2) Ana döngü: state/next_due zamanı geldiyse (ya da cihaz geç uyandıysa)
#     yenilemeyi çalıştırır, sonucu göre bir sonraki zamanı yazar, alarmı
#     hemen yeniden kurar ve uyanma olayını ya da süreyi bekler.
set -u

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"
LOG_TAG=maarifd

PID_FILE="$RUN_DIR/maarifd.pid"
LISTENER_PID=

mkdir -p "$RUN_DIR" "$STATE_DIR" || exit 1

OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -n "$OLD_PID" ] && [ "$OLD_PID" != "$$" ] && kill -0 "$OLD_PID" 2>/dev/null; then
  log_message "zaten çalışıyor (pid $OLD_PID)"
  exit 0
fi
printf '%s\n' "$$" > "$PID_FILE"

shutdown() {
  [ -n "$LISTENER_PID" ] && kill "$LISTENER_PID" 2>/dev/null
  [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$PID_FILE"
}
trap 'shutdown' 0
trap 'log_message "sinyal alındı, duruyor"; exit 0' HUP INT TERM

# Uykuya girerken kurulacak alarm süresi.
seconds_until_due() {
  if [ -d "$RUN_DIR/refresh.lock" ]; then
    # Yenileme yarıda kalıyor: kısa süre sonra uyan ki tamamlansın.
    printf '%s\n' "$SUSPEND_RETRY"
    return
  fi
  DUE=$(state_get next_due 0)
  case "$DUE" in ''|*[!0-9]*) DUE=0 ;; esac
  printf '%s\n' "$((DUE - $(now_epoch)))"
}

suspend_listener() {
  # Alt kabuk ana sürecin çıkış tuzağını (pid dosyasını silen) devralmasın.
  trap - 0
  trap 'exit 0' HUP INT TERM
  LOG_TAG=uyku
  while [ -f "$ENABLED_FILE" ]; do
    if EVENT=$("$LIPC_WAIT_BIN" com.lab126.powerd readyToSuspend 2>/dev/null); then
      WAKE_IN=$(seconds_until_due)
      arm_rtc "$WAKE_IN" && log_message "uykuya geçiyor; ${WAKE_IN}s sonra uyanacak ($EVENT)"
    else
      "$SLEEP_BIN" 5
    fi
  done
}

start_listener() {
  suspend_listener &
  LISTENER_PID=$!
}

# Bir sonraki yenileme zamanını hesapla ve yaz. $1 = son yenileme sonucu.
schedule_next() {
  NOW=$(now_epoch)
  BOUNDARY=$((NOW + $(seconds_to_next_boundary)))
  FAILS=$(state_get fails 0)
  case "$FAILS" in ''|*[!0-9]*) FAILS=0 ;; esac
  case "$1" in
    0|3) FAILS=0; NEXT=$BOUNDARY ;;
    75)  NEXT=$((NOW + 60)) ;;
    *)
      FAILS=$((FAILS + 1))
      if [ "$FAILS" -le "$RETRY_MAX" ]; then
        NEXT=$((NOW + RETRY_DELAY))
        [ "$NEXT" -gt "$BOUNDARY" ] && NEXT=$BOUNDARY
      else
        FAILS=0
        NEXT=$BOUNDARY
      fi
      ;;
  esac
  state_set fails "$FAILS"
  state_set next_due "$NEXT"
  arm_rtc "$((NEXT - NOW))" quiet || true
  log_message "sonraki yenileme $((NEXT - NOW))s sonra ($("$DATE_BIN" -d "@$NEXT" '+%H:%M' 2>/dev/null || printf '%s' "$NEXT"))"
}

# Yenilemeyi duvar saatiyle sınırlı çalıştır (busybox'ta timeout olmayabilir).
run_refresh() {
  /bin/sh "$SCRIPT_DIR/refresh.sh" auto &
  REFRESH_PID=$!
  STARTED=$(now_epoch)
  while kill -0 "$REFRESH_PID" 2>/dev/null; do
    if [ $(( $(now_epoch) - STARTED )) -gt "$REFRESH_TIMEOUT" ]; then
      log_message "yenileme ${REFRESH_TIMEOUT}s'yi aştı; durduruluyor"
      kill "$REFRESH_PID" 2>/dev/null
      "$SLEEP_BIN" 2
      kill -9 "$REFRESH_PID" 2>/dev/null
      rm -rf "$RUN_DIR/refresh.lock"
      wait "$REFRESH_PID" 2>/dev/null
      return 1
    fi
    "$SLEEP_BIN" 2
  done
  wait "$REFRESH_PID"
}

log_message "başladı (pid $$, pil %$(battery_level))"
# Açılışta hemen yenile.
state_set next_due "$(now_epoch)"
start_listener

while [ -f "$ENABLED_FILE" ]; do
  if ! userstore_available; then
    "$SLEEP_BIN" 30
    continue
  fi
  kill -0 "$LISTENER_PID" 2>/dev/null || { log_message "uyku dinleyicisi yeniden başlatılıyor"; start_listener; }

  DUE=$(state_get next_due 0)
  case "$DUE" in ''|*[!0-9]*) DUE=0 ;; esac
  NOW=$(now_epoch)
  if [ "$NOW" -ge "$DUE" ]; then
    [ "$DUE" -gt 0 ] && [ $((NOW - DUE)) -gt 300 ] && log_message "yenileme $((NOW - DUE))s gecikti; şimdi yapılıyor"
    run_refresh
    schedule_next "$?"
    /bin/sh "$SCRIPT_DIR/status.sh" quiet >/dev/null 2>&1 || true
    continue
  fi

  WAIT=$((DUE - NOW))
  [ "$WAIT" -gt "$MAX_WAIT" ] && WAIT=$MAX_WAIT
  # Uyanma olayı beklemeyi erken bitirir; uyku sırasında monoton süre
  # ilerlemediği için döngü her uyanışta saati yeniden kontrol eder.
  "$LIPC_WAIT_BIN" -s "$WAIT" com.lab126.powerd wakeupFromSuspend,resuming >/dev/null 2>&1
  # LIPC hemen dönerse (hata/eski firmware) döngü boşa dönmesin.
  [ $(( $(now_epoch) - NOW )) -lt 2 ] && "$SLEEP_BIN" 5
done

log_message "durdu (etkin değil)"
