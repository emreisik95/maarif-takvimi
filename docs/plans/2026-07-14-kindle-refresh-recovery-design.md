# Kindle Refresh and Recovery Design

## Problem statement

The Kindle lock-screen calendar currently fails in three related ways:

1. `update.sh` rewrites the server's valid 600x800 grayscale PNG with ImageMagick's
   `PNG8:` output format. That format is palette-indexed (PNG color type 3), which
   the target Kindle's `eips` renderer can interpret as stretched pixel rows.
2. A scheduled update is gated on a successful ICMP ping to `www.google.com`.
   Device logs show that the scheduler wakes at the intended times but aborts at
   this gate, so no HTTP request is attempted.
3. At 03:00 the regular image is replaced by white. If the first post-window
   download fails, there is no local copy to restore and the white image remains.

## Chosen design

Keep the existing RTC scheduler and change the update transaction. Image
normalization will preserve aspect ratio, center the result on a white 600x800
canvas, and explicitly request grayscale PNG color type 0. The script will no
longer use `PNG8:` or force a non-proportional `600x800!` resize.

The HTTP endpoint itself becomes the connectivity test. Each normal update turns
Wi-Fi on when necessary, then retries a bounded `curl` download with timeouts.
This removes the unrelated Google ping dependency and gives slow post-suspend
association time to complete. A download is not installed until it is non-empty
and successfully normalized.

Before the 03:00 white image is installed, the current non-white screensaver is
copied to a persistent last-known-good path on `/mnt/us`. After 04:00, a failed
download restores that backup and repaints it immediately when the screen saver
is active. Thus the blank window still works, but its end no longer depends on
network availability.

## Data flow and failure handling

Normal path: RTC wake -> enable Wi-Fi if needed -> retry `/image.png` -> normalize
to 600x800 grayscale -> atomically replace linkss image -> repaint if asleep.

03:00 path: copy the current calendar to last-known-good -> normalize/install
white -> wait until the scheduler's 04:00 boundary.

04:00 path: restore last-known-good and repaint immediately -> attempt the fresh
download afterward. Other download-failure paths also restore last-known-good
after retries are exhausted. The backup remains available for future recovery.

All transitions log their outcome. Temporary downloads and normalization files
are removed on failure, and a failed candidate never overwrites the installed
screensaver.

## Verification

Node tests run `update.sh` in a temporary sandbox with fake Kindle commands. They
verify retry behavior without a ping gate, last-known-good capture at 03:00,
post-window restoration on download failure, and normalization arguments that
preserve aspect ratio and force PNG color type 0. Existing server tests continue
to verify the 3-hour browser interval, and PNG header checks verify that both
local and live server output are 600x800, 8-bit grayscale.
