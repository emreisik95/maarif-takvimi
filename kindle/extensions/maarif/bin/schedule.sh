#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
MAARIF_BASE="${MAARIF_BASE:-$(dirname "$SCRIPT_DIR")}"
. "$SCRIPT_DIR/config.sh"
. "$SCRIPT_DIR/lib.sh"

case "${1:-}" in
  mode)
    current_mode
    ;;
  seconds)
    seconds_to_next_boundary
    ;;
  wait)
    [ -n "${2:-}" ] || exit 2
    wait_until_epoch "$2"
    ;;
  *)
    printf 'usage: %s {mode|seconds|wait EPOCH}\n' "$0" >&2
    exit 2
    ;;
esac

