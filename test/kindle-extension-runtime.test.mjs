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
  *cmState*)
    if [ "${'${STUB_WIFI_STATE_UNKNOWN:-0}'}" = 1 ]; then
      echo "getprop:$*" >> "$STUB_COMMAND_LOG"
      exit 0
    fi
    count=$(cat "$STUB_WIFI_STATE_COUNT" 2>/dev/null || printf '0')
    echo "getprop:$*" >> "$STUB_COMMAND_LOG"
    case "$count" in
      0) printf 'NOT_CONNECTED\\n' ;;
      1) printf 'ASSOCIATING\\n' ;;
      *) printf 'CONNECTED\\n' ;;
    esac
    printf '%s\\n' "$((count + 1))" > "$STUB_WIFI_STATE_COUNT"
    ;;
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
      STUB_WIFI_STATE_COUNT: `${root}/wifi-state-count`,
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

test('an LIPC timeout does not sleep the completed interval a second time', () => {
  const h = harness();
  executable(`${h.commands}/date-timeout`, `
if [ "$1" = "+%s" ]; then
  count=$(cat "$STUB_DATE_COUNT" 2>/dev/null || printf '0')
  case "$count" in 0) value=0 ;; *) value=100 ;; esac
  printf '%s\\n' "$((count + 1))" > "$STUB_DATE_COUNT"
  printf '%s\\n' "$value"
else
  printf '2026-07-14 00:00:00\\n'
fi
  `.trim());
  executable(`${h.commands}/lipc-timeout`, 'echo "wait:$2" >> "$STUB_COMMAND_LOG"; exit 1');

  const result = run('schedule.sh', ['wait', '100'], {
    ...h.env,
    DATE_BIN: `${h.commands}/date-timeout`,
    LIPC_WAIT_BIN: `${h.commands}/lipc-timeout`,
  });
  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /wait:100/);
  assert.doesNotMatch(commands, /sleep:/);
});

test('a backward clock correction recomputes the next wall-clock boundary', () => {
  const h = harness();
  executable(`${h.commands}/date-backward`, `
if [ "$1" = "+%s" ]; then
  count=$(cat "$STUB_DATE_COUNT" 2>/dev/null || printf '0')
  case "$count" in
    0) value=32400 ;;
    1) value=18000 ;;
    *) value=36000 ;;
  esac
  printf '%s\\n' "$((count + 1))" > "$STUB_DATE_COUNT"
  printf '%s\\n' "$value"
elif [ "$1" = "+%H:%M:%S" ]; then
  printf '05:00:00\\n'
else
  printf '2026-07-14 05:00:00\\n'
fi
  `.trim());
  executable(`${h.commands}/lipc-backward`, `
count=$(cat "$STUB_EVENT_COUNT" 2>/dev/null || printf '0')
echo "wait:$2" >> "$STUB_COMMAND_LOG"
printf '%s\\n' "$((count + 1))" > "$STUB_EVENT_COUNT"
[ "$count" -eq 0 ] && { printf 'wakeupFromSuspend\\n'; exit 0; }
exit 1
  `.trim());

  const result = run('schedule.sh', ['wait', '36000'], {
    ...h.env,
    DATE_BIN: `${h.commands}/date-backward`,
    LIPC_WAIT_BIN: `${h.commands}/lipc-backward`,
  });
  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /wait:3600[\s\S]*wait:7200/);
  assert.doesNotMatch(commands, /wait:18000/);
});

test('a failed boundary wait is retried without refreshing early', () => {
  const h = harness();
  const enabled = `${h.base}/enabled`;
  const waitFailures = `${h.root}/wait-failures`;
  const sleepCount = `${h.root}/sleep-count`;
  writeFileSync(enabled, '');

  executable(`${h.commands}/date-retry`, `
if [ "$1" = "+%s" ]; then
  count=$(cat "$STUB_WAIT_FAILURES" 2>/dev/null || printf '0')
  printf '%s\\n' "$((count + 1))" > "$STUB_WAIT_FAILURES"
  case "$count" in
    0) printf '100\\n' ;;
    1) exit 1 ;;
    2) printf '200\\n' ;;
    *) exit 1 ;;
  esac
else
  printf '2026-07-14 10:00:00\\n'
fi
  `.trim());
  executable(`${h.commands}/sleep-retry`, `
count=$(cat "$STUB_SLEEP_COUNT" 2>/dev/null || printf '0')
echo "sleep:$*" >> "$STUB_COMMAND_LOG"
printf '%s\\n' "$((count + 1))" > "$STUB_SLEEP_COUNT"
[ "$count" -ge 1 ] && rm -f "$STUB_ENABLED_FILE"
  `.trim());

  const result = run('daemon.sh', [], {
    ...h.env,
    MAARIF_NOW: '10:00:00',
    MAARIF_LOCK_DIR: `${h.root}/lock`,
    DATE_BIN: `${h.commands}/date-retry`,
    SLEEP_BIN: `${h.commands}/sleep-retry`,
    STUB_WAIT_FAILURES: waitFailures,
    STUB_SLEEP_COUNT: sleepCount,
    STUB_ENABLED_FILE: enabled,
  });
  assert.equal(result.status, 0, result.stderr);
  const curlCalls = readFileSync(h.commandLog, 'utf8').match(/^curl$/gm) ?? [];
  assert.equal(curlCalls.length, 1, 'refresh must not run again before a real boundary');
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
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /curl[\s\S]*convert[\s\S]*sync/);
  assert.ok((commands.match(/^sync$/gm) ?? []).length >= 2, 'rename metadata must also be synced');
});

test('normal refresh wakes Wi-Fi and waits for wifid connectivity before downloading', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', ['normal'], { ...h.env, MAARIF_NOW: '10:00:00' });
  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(
    commands,
    /setprop:com\.lab126\.cmd wirelessEnable 1[\s\S]*getprop:com\.lab126\.wifid cmState[\s\S]*getprop:com\.lab126\.wifid cmState[\s\S]*getprop:com\.lab126\.wifid cmState[\s\S]*curl/,
  );
});

test('normal refresh gives old firmware a full warmup when wifid state is unavailable', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));

  const result = run('refresh.sh', ['normal'], {
    ...h.env,
    MAARIF_NOW: '10:00:00',
    STUB_WIFI_STATE_UNKNOWN: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.match(commands, /setprop:com\.lab126\.cmd wirelessEnable 1/);
  assert.equal((commands.match(/^sleep:5$/gm) ?? []).length, 3);
  assert.ok(commands.indexOf('sleep:5') < commands.indexOf('curl'));
});

test('auto refresh switches to white if network warmup crosses into 03:00', () => {
  const h = harness();
  writeFileSync(h.target, png('VALID_OLD'));
  writeFileSync(h.lastGood, png('VALID_LAST_GOOD'));
  executable(`${h.commands}/date-crossover`, `
if [ "$1" = "+%H:%M:%S" ]; then
  count=$(cat "$STUB_DATE_COUNT" 2>/dev/null || printf '0')
  case "$count" in 0) value=02:59:50 ;; *) value=03:00:05 ;; esac
  printf '%s\\n' "$((count + 1))" > "$STUB_DATE_COUNT"
  printf '%s\\n' "$value"
else
  printf '2026-07-14 03:00:05\\n'
fi
  `.trim());

  const result = run('refresh.sh', [], {
    ...h.env,
    DATE_BIN: `${h.commands}/date-crossover`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(h.target), readFileSync(h.white));
  const commands = readFileSync(h.commandLog, 'utf8');
  assert.equal(commands.includes('curl'), false);
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
  assert.match(commands, /setprop:com\.lab126\.powerd preventScreenSaver 0/);
  assert.match(commands, /setprop:com\.lab126\.powerd stopSuspend 0/);
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
