import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Kindle lock screen automation updates the linkss screensaver image safely', () => {
  const config = readFileSync('kindle/extensions/onlinescreensaver/bin/config.sh', 'utf8');
  const updateScript = readFileSync('kindle/extensions/onlinescreensaver/bin/update.sh', 'utf8');
  const dashboardScript = readFileSync('kindle/extensions/maarif-dashboard/bin/show.sh', 'utf8');
  const menu = readFileSync('kindle/extensions/onlinescreensaver/menu.json', 'utf8');
  const diagnoseScript = readFileSync('kindle/extensions/onlinescreensaver/bin/diagnose.sh', 'utf8');

  assert.match(config, /DEFAULTINTERVAL=180/);
  assert.match(config, /SCHEDULE="00:00-03:00=60 03:00-04:00=60 04:00-24:00=180"/);
  assert.match(config, /IMAGE_URI="https:\/\/maarif-takvimi\.external\.emre\.zip\/image\.png"/);
  assert.match(config, /WHITE_IMAGE="\/mnt\/us\/extensions\/onlinescreensaver\/bin\/white\.png"/);
  assert.match(config, /SCREENSAVERFILE=\/mnt\/us\/linkss\/screensavers\/bg_ss00\.png/);
  assert.match(config, /LAST_GOOD_IMAGE=/);
  assert.match(config, /DOWNLOAD_ATTEMPTS=3/);
  assert.match(config, /IMAGE_ROTATION=0/);

  assert.match(updateScript, /HOUR=\$\(date '\+%H'\)/);
  assert.match(updateScript, /\[ "\$HOUR" = "03" \]/);
  assert.match(updateScript, /cp "\$WHITE_IMAGE" "\$TMPFILE"/);
  assert.match(updateScript, /normalize_screensaver_image\(\)/);
  assert.match(updateScript, /\/mnt\/us\/linkss\/bin\/convert/);
  assert.match(updateScript, /-alpha remove -alpha off/);
  assert.match(updateScript, /-colorspace Gray -type Grayscale -depth 8/);
  assert.match(updateScript, /-gravity center -extent/);
  assert.match(updateScript, /-define png:color-type=0/);
  assert.doesNotMatch(updateScript, /PNG8:|SCREEN_SIZE[^\n]*}!/);
  assert.doesNotMatch(updateScript, /\/bin\/ping|TEST_DOMAIN/);
  assert.match(updateScript, /LAST_GOOD_IMAGE/);
  assert.match(updateScript, /IMAGE_ROTATION/);
  assert.match(updateScript, /rm -f "\$SCREENSAVERFOLDER"\/\*\.png/);
  assert.doesNotMatch(updateScript, /preventScreenSaver|stopSuspend|framework stop/);
  assert.match(menu, /Write diagnostics log/);
  assert.match(diagnoseScript, /mount \| grep -E 'blanket\|custom_screensavers\|linkss'/);
  assert.match(diagnoseScript, /lipc-get-prop com\.lab126\.powerd preventScreenSaver/);

  assert.match(dashboardScript, /-gravity center -extent/);
  assert.match(dashboardScript, /-define png:color-type=0/);
  assert.doesNotMatch(dashboardScript, /PNG8:|MAARIF_SCREEN_SIZE[^\n]*}!/);
});
