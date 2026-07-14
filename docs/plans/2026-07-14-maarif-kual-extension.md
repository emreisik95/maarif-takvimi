# Reliable Maarif KUAL Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace both legacy Kindle integrations with one reboot-persistent `maarif` KUAL extension that refreshes on wall-clock boundaries, shows white exactly from 03:00 through 03:59, and preserves the last verified dashboard while offline.

**Architecture:** A BusyBox-compatible daemon computes absolute wall-clock boundaries and uses Kindle power events plus `rtcWakeup` without treating early wakes as timer completion. A transactional refresh script validates and normalizes downloads before atomically replacing both linkss and last-good images. A KUAL installer owns one upstart job so a single post-USB tap makes the daemon reboot-persistent.

**Tech Stack:** POSIX/BusyBox `sh`, Kindle LIPC/upstart/linkss tools, KUAL JSON/XML manifests, Node.js built-in test runner.

### Task 1: Replace legacy structural tests with the new extension contract

**Files:**
- Modify: `test/kindle-extension.test.mjs`
- Delete after the red run: `kindle/extensions/maarif-dashboard/`
- Delete after the red run: `kindle/extensions/onlinescreensaver/`

**Step 1: Write the failing test**

Assert that `kindle/extensions/maarif` is the only repository-owned Maarif scheduler, the manifest/menu parse, all actions exist, the config uses the production landscape endpoint and 600x800 output, the upstart job runs `daemon.sh` with `respawn`, and install/uninstall scripts remount root safely.

**Step 2: Run test to verify it fails**

Run: `node --test test/kindle-extension.test.mjs`
Expected: FAIL because `kindle/extensions/maarif` does not exist.

**Step 3: Remove superseded source directories**

Use `apply_patch` to delete the two old extension trees after the failing test has proved the new contract is absent.

**Step 4: Re-run to preserve the intended red state**

Run: `node --test test/kindle-extension.test.mjs`
Expected: FAIL only for missing new extension artifacts, never because old behavior still satisfies the test.

### Task 2: Specify wall-clock scheduling and shell runtime behavior

**Files:**
- Create: `test/kindle-extension-runtime.test.mjs`
- Create: `test/fixtures/kindle-bin/` test command stubs at runtime (temporary directories, not committed)

**Step 1: Write the failing runtime tests**

Spawn the real shell entry points with a temporary `MAARIF_BASE`, `MAARIF_TARGET`, `MAARIF_NOW`, and stub command path. Cover these behaviors independently:

- 02:59:30 schedules 30 seconds to 03:00.
- 03:00:00 and 03:59:59 select white mode without invoking curl.
- 04:00:00 selects normal mode and restores last-good before attempting download.
- 04:00:01 schedules the next boundary at 07:00.
- 22:00 schedules midnight, midnight schedules 03:00.
- successful PNG normalization atomically updates target and last-good.
- failed download leaves a valid target untouched.
- failed download with a missing target restores verified last-good.
- an all-black/corrupt last-good is rejected in favor of the packaged fallback.

**Step 2: Run tests to verify they fail**

Run: `node --test test/kindle-extension-runtime.test.mjs`
Expected: FAIL because schedule and refresh entry points are missing.

### Task 3: Implement tested scheduling and transactional refresh

**Files:**
- Create: `kindle/extensions/maarif/bin/config.sh`
- Create: `kindle/extensions/maarif/bin/lib.sh`
- Create: `kindle/extensions/maarif/bin/schedule.sh`
- Create: `kindle/extensions/maarif/bin/refresh.sh`
- Create: `kindle/extensions/maarif/bin/daemon.sh`
- Create: `kindle/extensions/maarif/assets/white.png`
- Create: `kindle/extensions/maarif/assets/fallback.png`

**Step 1: Implement the minimum schedule API**

`schedule.sh seconds` prints seconds until the next boundary; `schedule.sh mode` prints `white` only for hour 03 and `normal` otherwise. `MAARIF_NOW=HH:MM:SS` makes the calculation deterministic in tests.

**Step 2: Run schedule tests**

Run: `node --test test/kindle-extension-runtime.test.mjs --test-name-pattern='schedule|white mode'`
Expected: PASS for schedule cases; other runtime cases may remain failing.

**Step 3: Implement safe image validation and refresh**

Require a PNG signature, exact 600x800 output from linkss `identify`, 8-bit grayscale conversion, and non-blank pixel variance for normal images. Download into state-local temporary files, rename last-good and target only after every check passes, and never save white as last-good. Restore a verified last-good or fallback without rotating it a second time.

**Step 4: Run refresh tests**

Run: `node --test test/kindle-extension-runtime.test.mjs`
Expected: PASS.

**Step 5: Implement daemon wait loop**

Use an atomic lock directory and PID file. Continue waiting after early `wakeupFromSuspend`; on `readyToSuspend`, set `rtcWakeup` to the remaining seconds. Recompute mode and boundary after each completed target time, stop when `enabled` disappears, and clean the lock on signals.

**Step 6: Run structural and runtime tests**

Run: `node --test test/kindle-extension.test.mjs test/kindle-extension-runtime.test.mjs`
Expected: daemon-related assertions and all runtime tests PASS; install/menu assertions may remain failing.

### Task 4: Add reboot persistence and KUAL controls

**Files:**
- Create: `kindle/extensions/maarif/bin/maarif.conf`
- Create: `kindle/extensions/maarif/bin/install.sh`
- Create: `kindle/extensions/maarif/bin/start.sh`
- Create: `kindle/extensions/maarif/bin/stop.sh`
- Create: `kindle/extensions/maarif/bin/uninstall.sh`
- Create: `kindle/extensions/maarif/bin/status.sh`
- Create: `kindle/extensions/maarif/config.xml`
- Create: `kindle/extensions/maarif/menu.json`

**Step 1: Implement the upstart job**

Start after `lab126_gui`, stop with it, enable bounded respawn, require `/mnt/us/extensions/maarif/enabled`, and `exec /bin/sh .../daemon.sh` so upstart owns the daemon PID.

**Step 2: Implement atomic install/uninstall**

`install.sh` touches `enabled`, remounts root read-write, copies the job through a temporary file, renames it, restores root read-only via `trap`, and starts/restarts the job. `uninstall.sh` stops it, removes the job under the same remount protection, removes `enabled`, and leaves linkss/KUAL/KOReader untouched.

**Step 3: Implement KUAL manifest and status evidence**

Expose “Kur ve başlat”, “Şimdi güncelle”, “Durdur”, “Durum yaz”, and “Otomatik başlatmayı kaldır”. `status.sh` writes `/mnt/us/maarif-status.log` with job, marker, PID/lock, power, image identify, and recent log evidence.

**Step 4: Run the extension tests**

Run: `node --test test/kindle-extension.test.mjs test/kindle-extension-runtime.test.mjs`
Expected: PASS.

### Task 5: Verify the full repository and package

**Files:**
- Modify: `README.md`
- Modify if needed: `package.json`

**Step 1: Document installation and exact behavior**

Replace references to legacy extension names with `extensions/maarif`, the one-time KUAL install action, precise refresh boundaries, offline behavior, and status-log verification.

**Step 2: Run syntax and manifest checks**

Run: `find kindle/extensions/maarif/bin -type f -name '*.sh' -exec sh -n {} \;`
Expected: exit 0.

Run: `node -e "JSON.parse(require('fs').readFileSync('kindle/extensions/maarif/menu.json'))"`
Expected: exit 0.

Run: `find kindle/extensions/maarif/bin -type f -name '*.sh' -exec test -x {} \;`
Expected: exit 0.

**Step 3: Run the full suite**

Run: `npm test`
Expected: all tests PASS with zero failures.

**Step 4: Commit implementation**

```bash
git add kindle test README.md docs/plans/2026-07-14-maarif-kual-extension.md
git commit -m "feat: rebuild reliable Maarif Kindle extension"
```

### Task 6: Deploy to the still-mounted Kindle and prove byte equality

**Files:**
- Remove on device: `/Volumes/Kindle/extensions/onlinescreensaver/`
- Remove on device if present: `/Volumes/Kindle/extensions/maarif-dashboard/`
- Remove on device: `/Volumes/Kindle/_maarif_*`
- Remove on device: `/Volumes/Kindle/maarif-dashboard.log`
- Remove on device: `/Volumes/Kindle/maarif-diagnostics.log`
- Remove on device: `/Volumes/Kindle/onlinescreensaver.log`
- Create on device: `/Volumes/Kindle/extensions/maarif/`

**Step 1: Stage and validate a deployment copy off-device**

Copy only the tested `kindle/extensions/maarif` tree to a temporary staging directory, verify file list, permissions, PNG metadata, JSON, XML, and `sh -n` again.

**Step 2: Preserve only a verified current normal image**

If the current linkss image passes exact geometry and non-blank checks, seed the new `state/last-good.png`; otherwise use the tested fallback asset. Never carry the known-black legacy `last-good.png` forward.

**Step 3: Remove only scoped legacy artifacts and copy the new extension**

Do not touch `extensions/KUAL.cfg`, `MRInstaller`, `koreader`, `linkss`, books, fonts, or unrelated files.

**Step 4: Compare source and device byte-for-byte**

Run sorted SHA-256 manifests for the source/staging/device extension trees and `diff` them.
Expected: no differences.

**Step 5: Flush writes and inspect the mounted volume**

Run `sync`, re-list scoped paths, rerun JSON/shell/PNG checks directly against `/Volumes/Kindle`, and confirm sufficient free space.

**Step 6: Hand off the only device-side action**

Keep the device connected until every host-verifiable check passes. Then instruct the user to eject, open KUAL, choose Maarif → Kur ve başlat once, wait for status, and use Maarif → Durum yaz after a reboot to collect authoritative device-side proof.
