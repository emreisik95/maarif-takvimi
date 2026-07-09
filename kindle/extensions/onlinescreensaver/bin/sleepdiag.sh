#!/bin/sh
# Logs powerd state over 60s so we can see whether the device ever leaves the
# "Active" state (i.e. whether it actually sleeps / enters the screensaver).
# Run from KUAL, then press the POWER button and wait. Wake + replug USB after.
LOG=/mnt/us/maarif-sleepdiag.log
: > "$LOG"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >> "$LOG"; }

log "=== sleepdiag start ==="
log "preventScreenSaver=$(lipc-get-prop com.lab126.powerd preventScreenSaver 2>&1)"
log "processes possibly blocking sleep:"
ps auxww | grep -E 'maarif|loop\.sh|show\.sh|preventScreenSaver' | grep -v grep >> "$LOG" 2>&1
log "--- Press POWER now, logging for 60s ---"

command -v eips >/dev/null 2>&1 && eips 0 40 "sleepdiag: press POWER now (60s)" >/dev/null 2>&1

i=0
while [ "$i" -lt 20 ]; do
  ST="$(lipc-get-prop com.lab126.powerd status 2>&1 | grep -iE 'Powerd state|prevent|defer|drive_mode|suspend' | tr '\n' '|')"
  log "t${i} ${ST}"
  sleep 3
  i=$((i + 1))
done

log "=== sleepdiag end ==="
command -v eips >/dev/null 2>&1 && eips 0 40 "sleepdiag done - wake + replug USB" >/dev/null 2>&1
