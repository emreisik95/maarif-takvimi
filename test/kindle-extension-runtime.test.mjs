import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';

const extension = resolve('kindle/extensions/maarif');
const temporaryPaths = [];
const png = (tag) => Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from(tag),
]);

afterEach(() => {
  while (temporaryPaths.length) rmSync(temporaryPaths.pop(), { recursive: true, force: true });
});

function executable(path, body) {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

function harness() {
  const root = mkdtempSync(`${tmpdir()}/maarif-test-`);
  temporaryPaths.push(root);
  const base = `${root}/maarif`;
  const commands = `${root}/commands`;
  const target = `${root}/linkss/bg_ss00.png`;
  const commandLog = `${root}/commands.log`;
  const log = `${root}/maarif.log`;
  const downloaded = `${root}/downloaded.png`;
  const normalized = `${root}/normalized.png`;

  mkdirSync(`${base}/assets`, { recursive: true });
  mkdirSync(`${base}/state`, { recursive: true });
  mkdirSync(`${root}/linkss`, { recursive: true });
  mkdirSync(commands, { recursive: true });
  writeFileSync(`${base}/assets/white.png`, png('WHITE'));
  writeFileSync(`${base}/assets/fallback.png`, png('VALID_FALLBACK'));
  writeFileSync(downloaded, png('LANDSCAPE_DOWNLOAD'));
  writeFileSync(normalized, png('VALID_FRESH'));

  executable(`${commands}/curl`, `
echo curl >> "$STUB_COMMAND_LOG"
[ "${'${STUB_CURL_FAIL:-0}'}" = 1 ] && exit 22
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; out="$1"; fi
  shift
done
cp "$STUB_DOWNLOAD" "$out"
  `.trim());
  executable(`${commands}/convert`, `
echo convert >> "$STUB_COMMAND_LOG"
for out in "$@"; do :; done
cp "$STUB_NORMALIZED" "$out"
  `.trim());
  executable(`${commands}/identify`, `
for image in "$@"; do :; done
grep -q CORRUPT "$image" && exit 1
if grep -q BLACK "$image" || grep -q WHITE "$image"; then
  printf '600 800 8 Gray Grayscale 0'
else
  printf '600 800 8 Gray Grayscale 0.25'
fi
  `.trim());
  executable(`${commands}/lipc-get-prop`, `
case "$*" in
  *userstoreIsAvailable*) printf '%s\\n' "${'${STUB_USERSTORE:-1}'}" ;;
  *wirelessEnable*) printf '1\\n' ;;
  *status*) printf 'Screen Saver\\n' ;;
  *) printf '0\\n' ;;
esac
  `.trim());
  executable(`${commands}/lipc-set-prop`, 'echo "setprop:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/eips`, 'echo "eips:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/sync`, 'echo sync >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/sleep`, 'echo "sleep:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/mntroot`, 'echo "mntroot:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/start`, 'echo "start:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/stop`, 'echo "stop:$*" >> "$STUB_COMMAND_LOG"');
  executable(`${commands}/date`, `
if [ "$1" = "+%s" ]; then
  count=$(cat "$STUB_DATE_COUNT" 2>/dev/null || printf '0')
  case "$count" in 0) value=0 ;; 1) value=10 ;; *) value=100 ;; esac
  printf '%s\\n' "$((count + 1))" > "$STUB_DATE_COUNT"
  printf '%s\\n' "$value"
else
  printf '2026-07-14 00:00:00\\n'
fi
  `.trim());
  executable(`${commands}/lipc-wait-event`, `
count=$(cat "$STUB_EVENT_COUNT" 2>/dev/null || printf '0')
echo "wait:$2" >> "$STUB_COMMAND_LOG"
case "$count" in
  0) printf 'wakeupFromSuspend 10\\n' ;;
  1) printf 'readyToSuspend 1\\n' ;;
  *) printf 'timeout\\n' ;;
esac
printf '%s\\n' "$((count + 1))" > "$STUB_EVENT_COUNT"
  `.trim());

  return {
    root,
    base,
    target,
    commandLog,
    log,
    downloaded,
    normalized,
    commands,
    lastGood: `${base}/state/last-good.png`,
    fallback: `${base}/assets/fallback.png`,
    white: `${base}/assets/white.png`,
    env: {
      MAARIF_BASE: base,
      MAARIF_TARGET_IMAGE: target,
      MAARIF_LOG_FILE: log,
      MAARIF_LEGACY_JOB_1: `${root}/legacy-onlinescreensaver.conf`,
      MAARIF_LEGACY_JOB_2: `${root}/legacy-maarif-dashboard.conf`,
      CURL_BIN: `${commands}/curl`,
      CONVERT_BIN: `${commands}/convert`,
      IDENTIFY_BIN: `${commands}/identify`,
      LIPC_GET_BIN: `${commands}/lipc-get-prop`,
      LIPC_SET_BIN: `${commands}/lipc-set-prop`,
      LIPC_WAIT_BIN: `${commands}/lipc-wait-event`,
      EIPS_BIN: `${commands}/eips`,
      SYNC_BIN: `${commands}/sync`,
      SLEEP_BIN: `${commands}/sleep`,
      DATE_BIN: `${commands}/date`,
      MNTROOT_BIN: `${commands}/mntroot`,
      START_BIN: `${commands}/start`,
      STOP_BIN: `${commands}/stop`,
      STUB_COMMAND_LOG: commandLog,
      STUB_DOWNLOAD: downloaded,
      STUB_NORMALIZED: normalized,
      STUB_DATE_COUNT: `${root}/date-count`,
      STUB_EVENT_COUNT: `${root}/event-count`,
    },
  };
}

function run(name, args = [], env = {}) {
  return spawnSync('/bin/sh', [`${extension}/bin/${name}`, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function output(name, args, env) {
  const result = run(name, args, env);
  assert.equal(result.status, 0, `${name} failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}

test('schedule aligns updates to exact wall-clock boundaries', () => {
  const cases = [
    ['02:59:30', '30'],
    ['03:00:00', '3600'],
    ['03:59:59', '1'],
    ['04:00:01', '10799'],
    ['22:00:00', '10800'],
    ['00:00:00', '3600'],
    ['01:00:00', '7200'],
  ];

  for (const [now, seconds] of cases) {
    assert.equal(output('schedule.sh', ['seconds'], { MAARIF_NOW: now }), seconds, now);
  }
});

test('only the complete 03:00 hour selects white mode', () => {
  assert.equal(output('schedule.sh', ['mode'], { MAARIF_NOW: '02:59:59' }), 'normal');
  assert.equal(output('schedule.sh', ['mode'], { MAARIF_NOW: '03:00:00' }), 'white');
  assert.equal(output('schedule.sh', ['mode'], { MAARIF_NOW: '03:59:59' }), 'white');
  assert.equal(output('schedule.sh', ['mode'], { MAARIF_NOW: '04:00:00' }), 'normal');
});

test('an early wake does not complete the wait and suspend gets the remaining RTC time', () => {
  const h = harness();
  const result = run('schedule.sh', ['wait', '100'], h.env);
  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /wait:100/);
  assert.match(commands, /wait:90/);
  assert.match(commands, /setprop:-i com\.lab126\.powerd rtcWakeup 90/);
});

test('userstore availability prevents writes while USB mass storage owns the volume', () => {
  const h = harness();
  assert.equal(output('schedule.sh', ['userstore'], { ...h.env, STUB_USERSTORE: '1' }), 'available');

  const unavailable = run('schedule.sh', ['userstore'], { ...h.env, STUB_USERSTORE: '0' });
  assert.notEqual(unavailable.status, 0);
  assert.equal(unavailable.stdout.trim(), 'unavailable');
});

test('03:xx installs white without networking or replacing last-good', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', [], { ...h.env, MAARIF_NOW: '03:15:00' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), readFileSync(h.white));
  assert.deepEqual(readFileSync(h.lastGood), png('VALID_LAST_GOOD'));
  assert.equal(existsSync(h.commandLog) ? readFileSync(h.commandLog, 'utf8').includes('curl') : false, false);
});

test('a successful normal refresh commits the normalized image to target and last-good', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', ['normal'], { ...h.env, MAARIF_NOW: '10:00:00' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), readFileSync(h.normalized));
  assert.deepEqual(readFileSync(h.lastGood), readFileSync(h.normalized));
  assert.match(readFileSync(h.commandLog, 'utf8'), /curl[\s\S]*convert[\s\S]*sync/);
});

test('a failed download leaves an existing valid target untouched', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', ['normal'], {
    ...h.env,
    MAARIF_NOW: '10:00:00',
    STUB_CURL_FAIL: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), png('VALID_OLD'));
  assert.deepEqual(readFileSync(h.lastGood), png('VALID_LAST_GOOD'));
});

test('04:00 restores last-good before a network attempt and keeps it when offline', () => {
  const h = harness();
  writeFileSync(h.target, png('WHITE'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', [], {
    ...h.env,
    MAARIF_NOW: '04:00:00',
    STUB_CURL_FAIL: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), png('VALID_LAST_GOOD'));
  const lifecycle = readFileSync(h.log, 'utf8');
  assert.ok(lifecycle.indexOf('restored last-good') < lifecycle.indexOf('download attempt 1'));
});

test('offline refresh restores last-good when the target is missing', () => {
  const h = harness();
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', ['normal'], {
    ...h.env,
    MAARIF_NOW: '13:00:00',
    STUB_CURL_FAIL: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), png('VALID_LAST_GOOD'));
});

test('an all-black last-good is rejected and replaced by the packaged fallback', () => {
  const h = harness();
  writeFileSync(h.lastGood, png('BLACK'));

  const result = run('refresh.sh', ['normal'], {
    ...h.env,
    MAARIF_NOW: '16:00:00',
    STUB_CURL_FAIL: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), readFileSync(h.fallback));
  assert.deepEqual(readFileSync(h.lastGood), readFileSync(h.fallback));
});

test('install persists the upstart job, enables the daemon and restores root read-only', () => {
  const h = harness();
  const upstart = `${h.root}/upstart`;
  const job = `${upstart}/maarif.conf`;
  mkdirSync(upstart);
  writeFileSync(h.env.MAARIF_LEGACY_JOB_1, 'legacy online job');
  writeFileSync(h.env.MAARIF_LEGACY_JOB_2, 'legacy dashboard job');

  const result = run('install.sh', [], {
    ...h.env,
    MAARIF_UPSTART_JOB: job,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(`${h.base}/enabled`), true);
  assert.deepEqual(readFileSync(job), readFileSync(`${extension}/bin/maarif.conf`));
  assert.equal(existsSync(h.env.MAARIF_LEGACY_JOB_1), false);
  assert.equal(existsSync(h.env.MAARIF_LEGACY_JOB_2), false);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /mntroot:rw[\s\S]*mntroot:ro/);
  assert.match(commands, /start:maarif/);
});

test('a failed upstart copy still restores root read-only and does not enable', () => {
  const h = harness();
  const upstart = `${h.root}/upstart`;
  mkdirSync(upstart);
  executable(`${h.commands}/cp`, `
case "$1" in
  *maarif.conf) echo cp-failed >> "$STUB_COMMAND_LOG"; exit 1 ;;
  *) exec /bin/cp "$@" ;;
esac
  `.trim());

  const result = run('install.sh', [], {
    ...h.env,
    MAARIF_UPSTART_JOB: `${upstart}/maarif.conf`,
    PATH: `${h.commands}:${process.env.PATH}`,
  });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(`${h.base}/enabled`), false);
  assert.match(readFileSync(h.commandLog, 'utf8'), /mntroot:rw[\s\S]*cp-failed[\s\S]*mntroot:ro/);
});

test('a failed service start rolls back the upstart job and enabled marker', () => {
  const h = harness();
  const upstart = `${h.root}/upstart`;
  const job = `${upstart}/maarif.conf`;
  mkdirSync(upstart);
  executable(`${h.commands}/start`, 'echo "start:$*" >> "$STUB_COMMAND_LOG"; exit 1');

  const result = run('install.sh', [], {
    ...h.env,
    MAARIF_UPSTART_JOB: job,
  });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(job), false);
  assert.equal(existsSync(`${h.base}/enabled`), false);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /start:maarif[\s\S]*mntroot:rw[\s\S]*mntroot:ro/);
});

test('uninstall stops the service, removes its job and restores root read-only', () => {
  const h = harness();
  const upstart = `${h.root}/upstart`;
  const job = `${upstart}/maarif.conf`;
  mkdirSync(upstart);
  writeFileSync(job, 'installed job');
  writeFileSync(`${h.base}/enabled`, '');

  const result = run('uninstall.sh', [], {
    ...h.env,
    MAARIF_UPSTART_JOB: job,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(job), false);
  assert.equal(existsSync(`${h.base}/enabled`), false);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /stop:maarif/);
  assert.match(commands, /mntroot:rw[\s\S]*mntroot:ro/);
});
