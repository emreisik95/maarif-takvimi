# Kindle Refresh Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Kindle calendar render without stretching, refresh reliably every three hours, and always leave the 03:00-04:00 white window afterward even when the network is unavailable.

**Architecture:** Retain the existing RTC scheduler and make `update.sh` a recoverable image transaction. Replace the ICMP gate with bounded HTTP retries, preserve a last-known-good calendar before the white window, and normalize images to exact panel geometry without changing their aspect ratio or producing palette PNGs.

**Tech Stack:** POSIX shell on Kindle firmware, linkss ImageMagick 6 tools, Node.js built-in test runner for host-side behavioral tests.

### Task 1: Add executable Kindle update behavior tests

**Files:**
- Create: `test/kindle-update-behavior.test.mjs`
- Modify: `test/kindle-extension.test.mjs`

**Step 1: Write the failing tests**

Build a temporary extension sandbox with fake `date`, `curl`, `lipc-get-prop`,
`lipc-set-prop`, `convert`, `eips`, and `sleep` commands. Assert these behaviors:

```js
assert.equal(curlAttempts, 3);
assert.equal(pingAttempts, 0);
assert.equal(readFileSync(backup), 'calendar');
assert.equal(readFileSync(installed), 'calendar');
assert.match(convertArgs, /-resize 600x800(?!\!)/);
assert.match(convertArgs, /-gravity center -extent 600x800/);
assert.match(convertArgs, /-define png:color-type=0/);
assert.doesNotMatch(convertArgs, /PNG8:/);
```

**Step 2: Run tests to verify RED**

Run: `node --test test/kindle-update-behavior.test.mjs test/kindle-extension.test.mjs`

Expected: FAIL because the current script pings Google, has no retry transaction
or backup restore, and uses forced `PNG8:` normalization.

### Task 2: Implement eips-safe normalization

**Files:**
- Modify: `kindle/extensions/onlinescreensaver/bin/update.sh`
- Modify: `kindle/extensions/maarif-dashboard/bin/show.sh`

**Step 1: Replace forced palette normalization**

Use ImageMagick arguments equivalent to:

```sh
"$CONVERT" "$TMPFILE" \
  -resize "$SCREEN_SIZE" \
  -background white -gravity center -extent "$SCREEN_SIZE" \
  -alpha remove -alpha off -colorspace Gray -type Grayscale -depth 8 \
  -define png:color-type=0 "$NORMALIZED"
```

The dashboard path receives the same aspect-preserving grayscale rule.

**Step 2: Run the focused tests**

Run: `node --test test/kindle-update-behavior.test.mjs test/kindle-extension.test.mjs`

Expected: format and geometry assertions PASS; network/recovery assertions remain
RED until Task 3.

### Task 3: Implement retries and last-known-good recovery

**Files:**
- Modify: `kindle/extensions/onlinescreensaver/bin/config.sh`
- Modify: `kindle/extensions/onlinescreensaver/bin/update.sh`

**Step 1: Add bounded download configuration**

Add `DOWNLOAD_ATTEMPTS=3`, `DOWNLOAD_RETRY_DELAY=10`, curl connect/overall
timeouts, and `LAST_GOOD_IMAGE=/mnt/us/extensions/onlinescreensaver/bin/last-good.png`.

**Step 2: Replace the ping gate with direct download retries**

Implement `download_image()` so each attempt invokes `curl -f -k -L` with the
configured timeouts and only succeeds for a non-empty temporary file. Log each
attempt and sleep only between failures.

**Step 3: Preserve and restore the last-known-good image**

Keep `LAST_GOOD_IMAGE` current after every successful calendar install. At 03:00,
seed it from the installed calendar only when no backup exists, then install
white. At 04:00 restore `LAST_GOOD_IMAGE` before any network wait; on other normal
download failures restore it after retries. This guarantees prompt 04:00 recovery
without network and prevents a repeated 03:00 run from backing up white.

**Step 4: Run focused and full tests**

Run: `node --test test/kindle-update-behavior.test.mjs test/kindle-extension.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS with no test warnings or errors.

### Task 4: Deploy and verify

**Files:**
- Deploy: `kindle/extensions/onlinescreensaver/` to `/Volumes/Kindle/extensions/onlinescreensaver/`
- Deploy: `kindle/extensions/maarif-dashboard/bin/show.sh` to `/Volumes/Kindle/extensions/maarif-dashboard/bin/show.sh`

**Step 1: Verify source output and deployed shell syntax**

Run PNG header checks for live `/image.png` and local preview. Run `sh -n` on all
modified shell scripts and compare the deployed copies byte-for-byte.

**Step 2: Copy device files safely**

Back up the current extension, then copy only the modified scripts/config into
the mounted Kindle volume and preserve executable modes.

**Step 3: Device smoke test**

If the Kindle root shell is reachable, run one normal update with a short retry
configuration and inspect process/log/image headers. Otherwise verify the mounted
artifacts and document that runtime starts after safe USB eject/disconnect.

**Step 4: Deploy server only if server source changed**

The current live server already emits 600x800 8-bit grayscale PNG. Do not create
an unnecessary CapRover release unless server behavior changes during the fix.
