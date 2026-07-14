import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

test('Kindle lock screen automation updates the linkss screensaver image safely', () => {
  const config = readFileSync('kindle/extensions/onlinescreensaver/bin/config.sh', 'utf8');
  const updateScript = readFileSync('kindle/extensions/onlinescreensaver/bin/update.sh', 'utf8');
  const menu = readFileSync('kindle/extensions/onlinescreensaver/menu.json', 'utf8');
  const diagnoseScript = readFileSync('kindle/extensions/onlinescreensaver/bin/diagnose.sh', 'utf8');

  assert.match(config, /DEFAULTINTERVAL=180/);
  assert.match(config, /SCHEDULE="00:00-03:00=60 03:00-04:00=60 04:00-24:00=180"/);
  assert.match(config, /IMAGE_URI="https:\/\/maarif-takvimi\.external\.emre\.zip\/image-landscape\/auto\.png"/);
  assert.match(config, /WHITE_IMAGE="\/mnt\/us\/extensions\/onlinescreensaver\/bin\/white\.png"/);
  assert.match(config, /SCREENSAVERFILE=\/mnt\/us\/linkss\/screensavers\/bg_ss00\.png/);
  assert.match(config, /LAST_GOOD_IMAGE=/);
  assert.match(config, /DOWNLOAD_ATTEMPTS=3/);
  assert.match(config, /IMAGE_ROTATION=90/);

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
});

test('KUAL exposes exactly one Maarif menu', () => {
  const extensionRoot = 'kindle/extensions';
  const menuFiles = readdirSync(extensionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extensionRoot, entry.name, 'menu.json'))
    .filter(existsSync);

  const maarifMenus = menuFiles.flatMap((path) => {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    return (json.items || []).filter((item) => /Maarif/i.test(item.name || ''));
  });

  assert.equal(maarifMenus.length, 1);
  assert.equal(existsSync(join(extensionRoot, 'maarif-dashboard')), false);
});

test('the single KUAL menu provides detailed refresh, layout, orientation, and diagnostic settings', () => {
  const menu = JSON.parse(readFileSync('kindle/extensions/onlinescreensaver/menu.json', 'utf8'));
  const settingsPath = 'kindle/extensions/onlinescreensaver/bin/settings.sh';
  const statusPath = 'kindle/extensions/onlinescreensaver/bin/status.sh';

  assert.equal(existsSync(settingsPath), true);
  assert.equal(existsSync(statusPath), true);

  const rootItems = menu.items?.[0]?.items || [];
  for (const group of ['Refresh & schedule', 'Layout', 'Orientation', 'Status & diagnostics']) {
    assert.ok(rootItems.some((item) => item.name === group), group);
  }

  const menuText = JSON.stringify(menu);
  for (const param of [
    'interval_60', 'interval_180', 'interval_360',
    'layout_auto', 'layout_date', 'layout_agenda',
    'orientation_right', 'orientation_left',
  ]) {
    assert.match(menuText, new RegExp(`"params":"${param}"`));
  }

  const settings = readFileSync(settingsPath, 'utf8');
  assert.match(settings, /image-landscape\/auto\.png/);
  assert.match(settings, /image-landscape\/date-focus\.png/);
  assert.match(settings, /image-landscape\/agenda-focus\.png/);
  assert.match(settings, /IMAGE_ROTATION/);
  assert.match(settings, /SCHEDULE/);
});
