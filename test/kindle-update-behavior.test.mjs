import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const UPDATE_SOURCE = 'kindle/extensions/onlinescreensaver/bin/update.sh';
const UTILS_SOURCE = 'kindle/extensions/onlinescreensaver/bin/utils.sh';

test('normal update retries the image URL directly and installs eips-safe geometry', (t) => {
  const h = createHarness(t, { hour: '10', installed: 'old-calendar', curlSucceedsOn: 3 });

  h.runUpdate();

  assert.equal(h.curlAttempts(), 3, 'the image download should be retried three times');
  assert.equal(readFileSync(h.installed, 'utf8'), 'fresh-calendar');
  assert.equal(readFileSync(h.lastGood, 'utf8'), 'fresh-calendar');

  const convertArgs = readFileSync(h.convertLog, 'utf8');
  assert.match(convertArgs, /-resize 600x800(?:\s|$)/);
  assert.doesNotMatch(convertArgs, /600x800!/);
  assert.match(convertArgs, /-gravity center -extent 600x800/);
  assert.match(convertArgs, /-define png:color-type=0/);
  assert.doesNotMatch(convertArgs, /PNG8:/);
});

test('03:00 white window preserves the calendar and 04:00 restores it before network succeeds', (t) => {
  const h = createHarness(t, { hour: '03', installed: 'calendar-before-white', curlSucceedsOn: 999 });

  h.runUpdate();
  assert.equal(readFileSync(h.lastGood, 'utf8'), 'calendar-before-white');
  assert.equal(readFileSync(h.installed, 'utf8'), 'white');

  // A duplicate wake during the white hour must not replace the backup with white.
  h.runUpdate();
  assert.equal(readFileSync(h.lastGood, 'utf8'), 'calendar-before-white');

  h.setHour('04');
  h.resetCurlAttempts();
  h.runUpdate();

  assert.equal(h.curlAttempts(), 3);
  assert.equal(readFileSync(h.installed, 'utf8'), 'calendar-before-white');
  assert.match(readFileSync(h.eipsLog, 'utf8'), /-f -g/);
});

test('fresh landscape downloads rotate once while last-known-good recovery does not rotate again', (t) => {
  const h = createHarness(t, {
    hour: '10', installed: 'old-calendar', curlSucceedsOn: 1, imageRotation: -90,
  });

  h.runUpdate();
  assert.match(readFileSync(h.convertLog, 'utf8'), /-rotate -90/);
  assert.equal(readFileSync(h.lastGood, 'utf8'), 'fresh-calendar');

  h.clearConvertLog();
  h.setHour('04');
  h.setCurlSucceedsOn(999);
  h.resetCurlAttempts();
  h.runUpdate();

  const recoveryArgs = readFileSync(h.convertLog, 'utf8');
  assert.doesNotMatch(recoveryArgs, /-rotate -90/);
  assert.equal(readFileSync(h.installed, 'utf8'), 'fresh-calendar');
});

test('an awake Kindle keeps a successful download instead of restoring the old backup', (t) => {
  const h = createHarness(t, {
    hour: '10',
    installed: 'old-calendar',
    lastGoodContent: 'old-calendar',
    curlSucceedsOn: 1,
    powerStatus: 'Active',
  });

  const result = h.runUpdate();

  assert.equal(result.status, 0);
  assert.equal(readFileSync(h.installed, 'utf8'), 'fresh-calendar');
  assert.equal(readFileSync(h.lastGood, 'utf8'), 'fresh-calendar');
  assert.doesNotMatch(readFileSync(h.log, 'utf8'), /Downloaded image could not be installed/);
});

function createHarness(t, {
  hour,
  installed,
  curlSucceedsOn,
  imageRotation = 0,
  lastGoodContent,
  powerStatus = 'Screen Saver',
}) {
  const root = mkdtempSync(join(tmpdir(), 'maarif-kindle-test-'));
  const extension = join(root, 'extension', 'bin');
  const screensavers = join(root, 'screensavers');
  const fakeBin = join(root, 'fake-bin');
  mkdirSync(extension, { recursive: true });
  mkdirSync(screensavers, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  copyFileSync(UPDATE_SOURCE, join(extension, 'update.sh'));
  copyFileSync(UTILS_SOURCE, join(extension, 'utils.sh'));

  const installedPath = join(screensavers, 'bg_ss00.png');
  const white = join(extension, 'white.png');
  const lastGood = join(extension, 'last-good.png');
  const tmp = join(root, 'download.png');
  const log = join(root, 'update.log');
  const curlCount = join(root, 'curl-count');
  const curlSource = join(root, 'curl-source.png');
  const convertLog = join(root, 'convert.log');
  const eipsLog = join(root, 'eips.log');
  const lipcLog = join(root, 'lipc.log');
  const sleepLog = join(root, 'sleep.log');
  const hourFile = join(root, 'hour');

  writeFileSync(installedPath, installed);
  writeFileSync(white, 'white');
  writeFileSync(curlSource, 'fresh-calendar');
  writeFileSync(hourFile, hour);
  if (lastGoodContent != null) writeFileSync(lastGood, lastGoodContent);

  writeFileSync(join(extension, 'config.sh'), `
DEFAULTINTERVAL=180
SCHEDULE="00:00-03:00=60 03:00-04:00=60 04:00-24:00=180"
IMAGE_URI="https://example.test/image.png"
WHITE_IMAGE="${white}"
LAST_GOOD_IMAGE="${lastGood}"
SCREENSAVERFOLDER="${screensavers}/"
SCREENSAVERFILE="${installedPath}"
SCREEN_SIZE=600x800
IMAGE_ROTATION=${imageRotation}
LOGGING=1
LOGFILE="${log}"
DISABLE_WIFI=0
TEST_DOMAIN="invalid.invalid"
NETWORK_TIMEOUT=1
DOWNLOAD_ATTEMPTS=3
DOWNLOAD_RETRY_DELAY=0
CURL_CONNECT_TIMEOUT=1
CURL_MAX_TIME=1
TMPFILE="${tmp}"
CONVERT="${join(fakeBin, 'convert')}"
`);

  executable(join(fakeBin, 'date'), `#!/bin/sh
if [ "\${1:-}" = "+%H" ]; then
  cat "$MOCK_HOUR_FILE"
else
  printf '%s\\n' 'Tue Jul 14 04:00:00 GMT+3 2026'
fi
`);

  executable(join(fakeBin, 'curl'), `#!/bin/sh
COUNT=0
[ ! -f "$CURL_COUNT_FILE" ] || COUNT=$(cat "$CURL_COUNT_FILE")
COUNT=$((COUNT + 1))
printf '%s\\n' "$COUNT" > "$CURL_COUNT_FILE"
OUT=""
PREV=""
for ARG in "$@"; do
  [ "$PREV" != "-o" ] || OUT="$ARG"
  PREV="$ARG"
done
if [ "$COUNT" -ge "$CURL_SUCCEED_ON" ]; then
  cp "$CURL_SOURCE" "$OUT"
  exit 0
fi
rm -f "$OUT"
exit 7
`);

  executable(join(fakeBin, 'convert'), `#!/bin/sh
printf '%s\\n' "$*" >> "$CONVERT_LOG"
IN="$1"
for ARG in "$@"; do OUT="$ARG"; done
case "$OUT" in
  PNG:*|PNG8:*) OUT=\${OUT#*:} ;;
esac
cp "$IN" "$OUT"
`);

  executable(join(fakeBin, 'lipc-get-prop'), `#!/bin/sh
case "$*" in
  *wirelessEnable*) printf '%s\\n' 1 ;;
  *status*) printf '%s\\n' "$POWER_STATUS" ;;
esac
`);
  executable(join(fakeBin, 'lipc-set-prop'), `#!/bin/sh
printf '%s\\n' "$*" >> "$LIPC_LOG"
`);
  executable(join(fakeBin, 'eips'), `#!/bin/sh
printf '%s\\n' "$*" >> "$EIPS_LOG"
`);
  executable(join(fakeBin, 'sleep'), `#!/bin/sh
printf '%s\\n' "$*" >> "$SLEEP_LOG"
`);

  const env = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    MOCK_HOUR_FILE: hourFile,
    CURL_COUNT_FILE: curlCount,
    CURL_SOURCE: curlSource,
    CURL_SUCCEED_ON: String(curlSucceedsOn),
    CONVERT_LOG: convertLog,
    EIPS_LOG: eipsLog,
    LIPC_LOG: lipcLog,
    SLEEP_LOG: sleepLog,
    POWER_STATUS: powerStatus,
  };

  return {
    installed: installedPath,
    lastGood,
    convertLog,
    eipsLog,
    log,
    runUpdate() {
      const result = spawnSync('/bin/sh', [join(extension, 'update.sh')], {
        cwd: extension,
        env,
        encoding: 'utf8',
      });
      assert.equal(result.error, undefined);
      return result;
    },
    setHour(value) {
      writeFileSync(hourFile, value);
    },
    curlAttempts() {
      return existsSync(curlCount) ? Number(readFileSync(curlCount, 'utf8')) : 0;
    },
    resetCurlAttempts() {
      rmSync(curlCount, { force: true });
    },
    setCurlSucceedsOn(value) {
      env.CURL_SUCCEED_ON = String(value);
    },
    clearConvertLog() {
      rmSync(convertLog, { force: true });
    },
  };
}

function executable(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}
