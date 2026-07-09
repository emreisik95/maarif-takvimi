#!/bin/sh
set -u

URL="${MAARIF_URL:-https://maarif-takvimi.external.emre.zip/image.png}"
OUT="${MAARIF_OUT:-/tmp/maarif-dashboard.png}"
TMP="${OUT}.tmp"
LOG="${MAARIF_LOG:-/mnt/us/maarif-dashboard.log}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}

show_status() {
  if command -v eips >/dev/null 2>&1; then
    eips 0 39 "$*" >/dev/null 2>&1 || true
  fi
}

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -L -k --connect-timeout 30 -m 120 -o "$TMP" "$URL"
    return $?
  fi

  if command -v wget >/dev/null 2>&1; then
    wget --no-check-certificate -O "$TMP" "$URL"
    return $?
  fi

  return 127
}

normalize_image() {
  # eips renkli (RGB/RGBA) PNG'yi satır baytlarını piksel sanarak yatayda gerer.
  # linkss'in convert'i varsa panele birebir 8-bit gri PNG'ye indir; yoksa
  # sunucunun zaten gri PNG verdiğine güven (src/raster.js grayscale üretir).
  CONVERT=/mnt/us/linkss/bin/convert
  [ -x "$CONVERT" ] || return 0
  N="${OUT}.norm"
  if "$CONVERT" "$OUT" -resize "${MAARIF_SCREEN_SIZE:-600x800}!" -background white -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 "PNG8:$N"; then
    mv "$N" "$OUT"
    log "normalize ok"
  else
    rm -f "$N"
    log "normalize failed, using raw image"
  fi
}

log "download start: $URL"

if download && [ -s "$TMP" ]; then
  mv "$TMP" "$OUT"
  sync
  log "download ok: $OUT"
  normalize_image
  if command -v eips >/dev/null 2>&1; then
    eips -c >/dev/null 2>&1 || true
    eips -f -g "$OUT"
    log "display ok"
  else
    log "eips not found"
    exit 2
  fi
else
  rm -f "$TMP"
  log "download failed"
  show_status "Maarif: download failed"
  exit 1
fi
