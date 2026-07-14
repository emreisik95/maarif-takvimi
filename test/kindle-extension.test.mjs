import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = 'kindle/extensions/maarif';
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('one Maarif extension replaces both legacy schedulers', () => {
  assert.equal(existsSync(root), true, 'new maarif extension must exist');
  assert.equal(existsSync('kindle/extensions/maarif-dashboard'), false);
  assert.equal(existsSync('kindle/extensions/onlinescreensaver'), false);
});

test('KUAL metadata exposes only the supported lifecycle actions', () => {
  const config = read('config.xml');
  const menu = JSON.parse(read('menu.json'));
  const extension = menu.items?.[0];

  assert.match(config, /<name>Maarif Dashboard<\/name>/);
  assert.match(config, /<id>maarif-dashboard<\/id>/);
  assert.equal(extension?.name, 'Maarif');
  assert.deepEqual(
    extension.items.map(({ name, action }) => ({ name, action })),
    [
      { name: 'Kur ve başlat', action: 'bin/install.sh' },
      { name: 'Şimdi güncelle', action: 'bin/refresh.sh' },
      { name: 'Durdur', action: 'bin/stop.sh' },
      { name: 'Durum yaz', action: 'bin/status.sh' },
      { name: 'Otomatik başlatmayı kaldır', action: 'bin/uninstall.sh' },
    ],
  );

  for (const { action } of extension.items) {
    assert.equal(existsSync(`${root}/${action}`), true, `${action} must exist`);
  }
});

test('configuration targets the production landscape dashboard and Kindle panel', () => {
  const config = read('bin/config.sh');

  assert.match(config, /IMAGE_URL=.*image-landscape\/auto\.png/);
  assert.match(config, /SCREEN_SIZE=.*600x800/);
  assert.match(config, /IMAGE_ROTATION=.*90/);
  assert.match(config, /TARGET_IMAGE=.*\/mnt\/us\/linkss\/screensavers\/bg_ss00\.png/);
  assert.match(config, /STATE_DIR=.*MAARIF_BASE\/state/);
  assert.match(config, /LAST_GOOD_IMAGE=.*STATE_DIR\/last-good\.png/);
  assert.match(config, /DOWNLOAD_ATTEMPTS=.*3/);

  const white = readFileSync(`${root}/assets/white.png`);
  const fallback = readFileSync(`${root}/assets/fallback.png`);
  const initialLastGood = readFileSync(`${root}/state/last-good.png`);
  assert.notDeepEqual(fallback, white, 'offline fallback must not be blank white');
  assert.deepEqual(initialLastGood, fallback, 'initial last-good must be the verified fallback');
});

test('upstart owns a reboot-persistent single foreground daemon', () => {
  const job = read('bin/maarif.conf');
  const daemon = read('bin/daemon.sh');

  assert.match(job, /start on started lab126_gui/);
  assert.match(job, /stop on stopping lab126_gui/);
  assert.match(job, /^respawn$/m);
  assert.match(job, /respawn limit 5 60/);
  assert.match(job, /\/mnt\/base-us\/extensions\/maarif\/enabled/);
  assert.match(job, /MAARIF_BASE=\/mnt\/us\/extensions\/maarif/);
  assert.match(job, /exec \/bin\/sh \/mnt\/base-us\/extensions\/maarif\/bin\/daemon\.sh/);
  assert.match(daemon, /mkdir "\$LOCK_DIR"/);
  assert.match(daemon, /kill -0/);
  assert.match(daemon, /trap .*cleanup/);
  assert.match(daemon, /userstore_available/);
  assert.doesNotMatch(daemon, /sleep 10800/);
});

test('install and uninstall always restore the Kindle root filesystem read-only', () => {
  const install = read('bin/install.sh');
  const uninstall = read('bin/uninstall.sh');

  for (const script of [install, uninstall]) {
    assert.match(script, /MNTROOT_BIN.*rw/);
    assert.match(script, /MNTROOT_BIN.*ro/);
    assert.match(script, /trap .*remount_ro/);
    assert.match(script, /\/etc\/upstart\/maarif\.conf/);
  }
  assert.match(install, /UPSTART_JOB.*\.tmp\.\$\$/);
  assert.match(install, /mv .*UPSTART_JOB/);
  assert.match(install, /START_BIN.*maarif/);
  assert.match(install, /onlinescreensaver.*scheduler\.sh/);
  assert.match(install, /maarif-dashboard.*loop\.sh/);
  assert.match(install, /\/etc\/upstart\/onlinescreensaver\.conf/);
  assert.match(install, /\/etc\/upstart\/maarif-dashboard\.conf/);
  assert.match(uninstall, /STOP_BIN.*maarif/);
});

test('refresh validates, normalizes and commits images transactionally', () => {
  const refresh = read('bin/refresh.sh');
  const library = read('bin/lib.sh');

  assert.match(refresh, /CURL_BIN.*--connect-timeout/);
  assert.match(refresh, /normalize_image/);
  assert.match(refresh, /validate_normal_image/);
  assert.match(refresh, /LAST_GOOD_IMAGE.*\.tmp\.\$\$/);
  assert.match(refresh, /TARGET_IMAGE.*\.tmp\.\$\$/);
  assert.match(refresh, /mv .*LAST_GOOD_IMAGE/);
  assert.match(refresh, /mv .*TARGET_IMAGE/);
  assert.match(library, /89504e470d0a1a0a/);
  assert.match(library, /standard_deviation/);
  assert.match(library, /600 800 8/);
});
