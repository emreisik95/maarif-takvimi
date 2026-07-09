#!/bin/sh
LOG=/mnt/us/maarif-diagnostics.log

{
  echo "=== Maarif diagnostics $(date) ==="
  echo
  echo "eips framebuffer info (-i):"
  eips -i 2>&1
  echo
  echo "powerd status:"
  lipc-get-prop com.lab126.powerd status 2>&1
  echo
  echo "linkss markers:"
  ls -la /mnt/us/linkss 2>&1
  echo
  echo "linkss screensavers:"
  ls -la /mnt/us/linkss/screensavers 2>&1
  echo
  echo "screensaver files:"
  /mnt/us/linkss/bin/identify /mnt/us/linkss/screensavers/*.png 2>&1
  echo
  echo "mounts:"
  mount | grep -E 'blanket|custom_screensavers|linkss' 2>&1
  echo
  echo "/usr/share/blanket/screensaver:"
  ls -la /usr/share/blanket/screensaver 2>&1
  echo
  echo "/var/local/custom_screensavers:"
  ls -la /var/local/custom_screensavers 2>&1
  echo
  echo "power blockers:"
  lipc-get-prop com.lab126.powerd preventScreenSaver 2>&1
  lipc-get-prop com.lab126.powerd stopSuspend 2>&1
  echo
  echo "processes:"
  ps auxww | grep -E 'linkss|onlinescreensaver|maarif|framework|powerd' | grep -v grep 2>&1
} > "$LOG" 2>&1

eips 0 38 "Maarif diagnostics written"
