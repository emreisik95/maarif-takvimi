// Kindle "maarif" eklentisi (v2) — statik kontroller + sahte Kindle araçlarıyla
// çalışma zamanı testleri.
import assert from 'node:assert/strict';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';

const root = 'kindle/extensions/maarif';
const SH = process.env.MAARIF_TEST_SH || '/bin/sh';
const ext = resolve(root);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const temps = [];
afterEach(() => { while (temps.length) rmSync(temps.pop(), { recursive: true, force: true }); });

const png = (tag) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(tag)]);

function exe(path, body) {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

// Sahte Kindle: lipc, curl, convert, identify, eips, mntroot, start/stop.
function harness(opts = {}) {
  const dir = mkdtempSync(`${tmpdir()}/maarif-v2-`);
  temps.push(dir);
  const base = `${dir}/ext`;
  const bin = `${dir}/stubs`;
  for (const d of [`${base}/assets`, `${base}/state`, bin, `${dir}/linkss`, `${dir}/upstart`, `${dir}/run`]) {
    mkdirSync(d, { recursive: true });
  }
  writeFileSync(`${base}/assets/white.png`, png('WHITE'));
  writeFileSync(`${base}/assets/fallback.png`, png('FALLBACK'));
  writeFileSync(`${dir}/download.png`, png('DOWNLOAD'));
  writeFileSync(`${dir}/normalized.png`, png('FRESH'));
  const cmdlog = `${dir}/commands.log`;

  exe(`${bin}/curl`, `
echo "curl $*" >> "${cmdlog}"
[ "\${STUB_CURL_FAIL:-0}" = 1 ] && { echo "curl: (6) Could not resolve host" >&2; exit 6; }
out=""; while [ "$#" -gt 0 ]; do [ "$1" = "-o" ] && { shift; out="$1"; }; shift; done
cp "${dir}/download.png" "$out"`);
  exe(`${bin}/convert`, `echo convert >> "${cmdlog}"; for o in "$@"; do :; done; cp "${dir}/normalized.png" "$o"`);
  exe(`${bin}/identify`, `
for i in "$@"; do :; done
grep -q CORRUPT "$i" && exit 1
if grep -q WHITE "$i"; then printf '600 800 8 Gray 0'; else printf '600 800 8 Gray 0.25'; fi`);
  exe(`${bin}/lipc-get-prop`, `
case "$*" in
  *userstoreIsAvailable*) echo "\${STUB_USERSTORE:-1}" ;;
  *cmState*) echo "\${STUB_WIFI:-CONNECTED}" ;;
  *wirelessEnable*) echo 1 ;;
  *battLevel*) echo 77 ;;
  *status*) echo "Powerd state: Screen Saver" ;;
  *) echo 0 ;;
esac`);
  exe(`${bin}/lipc-set-prop`, `echo "setprop $*" >> "${cmdlog}"`);
  // readyToSuspend: ilk çağrıda olay ver, sonra hata. -s (bekleme): döngüyü bitir.
  exe(`${bin}/lipc-wait-event`, `
echo "wait $*" >> "${cmdlog}"
if [ "$1" = "-s" ]; then /bin/sleep 0.8; rm -f "${base}/enabled"; exit 1; fi
n=$(cat "${dir}/rts.count" 2>/dev/null || echo 0); echo $((n + 1)) > "${dir}/rts.count"
if [ "$n" = 0 ]; then /bin/sleep 0.3; echo "readyToSuspend 10"; exit 0; fi
/bin/sleep 0.05; exit 1`);
  for (const c of ['eips', 'sync', 'mntroot', 'start', 'stop']) {
    exe(`${bin}/${c}`, `echo "${c} $*" >> "${cmdlog}"`);
  }
  exe(`${bin}/sleep`, `echo "sleep $*" >> "${cmdlog}"; /bin/sleep 0.01`);
  exe(`${bin}/date`, `
case "$1" in
  +%s) echo "\${STUB_EPOCH:-1000000}" ;;
  +%H:%M:%S) echo "\${STUB_HMS:-12:00:00}" ;;
  -d) echo "13:00" ;;
  *) echo "2026-11-10 12:00:00" ;;
esac`);

  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MAARIF_BASE: base,
    MAARIF_RUN_DIR: `${dir}/run`,
    MAARIF_TARGET_IMAGE: `${dir}/linkss/bg_ss00.png`,
    MAARIF_LOG_FILE: `${dir}/maarif.log`,
    MAARIF_STATUS_FILE: `${dir}/status.txt`,
    MAARIF_UPSTART_JOB: `${dir}/upstart/maarif.conf`,
    MAARIF_LEGACY_TMP: `${dir}/legacy-tmp`,
    MAARIF_CA_CERT: `${dir}/ca.pem`,
    CONVERT_BIN: `${bin}/convert`,
    IDENTIFY_BIN: `${bin}/identify`,
    ...opts.env,
  };
  const run = (script, args = [], extra = {}) => spawnSync(SH, [`${ext}/bin/${script}`, ...args], {
    env: { ...env, ...extra }, encoding: 'utf8', timeout: 20000,
  });
  const sh = (code, extra = {}) => spawnSync(SH, ['-c', `. "${ext}/bin/config.sh"; . "${ext}/bin/lib.sh"; ${code}`], {
    env: { ...env, ...extra }, encoding: 'utf8',
  });
  const commands = () => (existsSync(cmdlog) ? readFileSync(cmdlog, 'utf8') : '');
  const log = () => (existsSync(`${dir}/maarif.log`) ? readFileSync(`${dir}/maarif.log`, 'utf8') : '');
  const state = (name) => readFileSync(`${base}/state/${name}`, 'utf8').trim();
  return { dir, base, run, sh, commands, log, state, target: `${dir}/linkss/bg_ss00.png` };
}

// --- Statik ---------------------------------------------------------------

test('KUAL menüsü yalnızca var olan betikleri çağırır', () => {
  const menu = JSON.parse(read('menu.json'));
  const items = menu.items[0].items;
  assert.deepEqual(items.map((i) => i.name), [
    'Kur ve başlat', 'Şimdi güncelle', 'Durum yaz', 'Durdur', 'Otomatik başlatmayı kaldır',
  ]);
  for (const { action } of items) assert.ok(existsSync(`${root}/${action}`), action);
  assert.equal(existsSync('kindle/extensions/onlinescreensaver'), false);
});

test('upstart işi yeni zamanlayıcıyı ön planda ve respawn ile çalıştırır', () => {
  const job = read('bin/maarif.conf');
  assert.match(job, /start on started lab126_gui/);
  assert.match(job, /respawn/);
  assert.match(job, /exec \/bin\/sh \/mnt\/base-us\/extensions\/maarif\/bin\/maarifd\.sh/);
  assert.equal(existsSync(`${root}/bin/daemon.sh`), false, 'eski daemon kaldırılmalı');
});

test('ayarlar yatay sunucu görselini ve linkss hedefini kullanır', () => {
  const config = read('bin/config.sh');
  assert.match(config, /IMAGE_URL=.*image-landscape\/auto\.png/);
  assert.match(config, /TARGET_IMAGE=.*\/mnt\/us\/linkss\/screensavers\/bg_ss00\.png/);
  assert.match(config, /maarif\.cfg/);
  assert.notDeepEqual(readFileSync(`${root}/assets/fallback.png`), readFileSync(`${root}/assets/white.png`));
});

test('tüm betikler sözdizimsel olarak geçerli', () => {
  for (const f of ['config', 'lib', 'maarifd', 'refresh', 'status', 'install', 'stop', 'uninstall']) {
    const r = spawnSync(SH, ['-n', `${root}/bin/${f}.sh`]);
    assert.equal(r.status, 0, `${f}.sh: ${r.stderr}`);
  }
});

// --- Zamanlama ---------------------------------------------------------------

test('bir sonraki yenileme anı SCHEDULE listesinden hesaplanır', () => {
  const h = harness();
  const next = (hms) => h.sh('seconds_to_next_boundary', { MAARIF_NOW_HMS: hms }).stdout.trim();
  assert.equal(next('12:59:30'), '30');
  assert.equal(next('13:00:00'), String(3 * 3600));      // tam sınırda bir sonrakine
  assert.equal(next('22:30:00'), String(2.5 * 3600));    // gece yarısını aşar (01:00)
  assert.equal(next('03:10:00'), String(50 * 60));       // beyaz pencere 04:00'te biter
});

// --- Yenileme ------------------------------------------------------------------

test('başarılı yenileme görseli ekrana ve son iyi görsele koyar, cihaz bilgisini gönderir', () => {
  const h = harness();
  const r = h.run('refresh.sh', ['normal']);
  assert.equal(r.status, 0, r.stderr + h.log());
  assert.match(readFileSync(h.target, 'utf8'), /FRESH/);
  assert.match(readFileSync(`${h.base}/state/last-good.png`, 'utf8'), /FRESH/);
  assert.match(h.commands(), /curl .*auto\.png\?src=kindle&bat=77/);
  assert.match(h.commands(), /eips -f -g/);
  assert.match(h.log(), /takvim güncellendi/);
  assert.ok(h.state('last_ok'));
});

test('indirme başarısızsa ekrandaki görsele dokunmaz ve hatayı kaydeder', () => {
  const h = harness();
  writeFileSync(h.target, png('OLD'));
  const r = h.run('refresh.sh', ['normal'], { STUB_CURL_FAIL: '1' });
  assert.equal(r.status, 1);
  assert.match(readFileSync(h.target, 'utf8'), /OLD/);
  assert.match(h.state('last_error'), /indirme/);
  assert.match(h.log(), /Could not resolve host/);
});

test('hedef görsel bozuksa ağdan önce yedek görsel konur', () => {
  const h = harness();
  writeFileSync(h.target, png('CORRUPT'));
  h.run('refresh.sh', ['normal'], { STUB_CURL_FAIL: '1' });
  assert.match(readFileSync(h.target, 'utf8'), /FALLBACK/);
});

test('03:xx otomatik yenileme ağa çıkmadan beyaz ekran koyar', () => {
  const h = harness({ env: { STUB_HMS: '03:00:05' } });
  const r = h.run('refresh.sh', ['auto']);
  assert.equal(r.status, 3);
  assert.match(readFileSync(h.target, 'utf8'), /WHITE/);
  assert.doesNotMatch(h.commands(), /curl/);
});

test('aynı anda ikinci yenileme atlanır', () => {
  const h = harness();
  mkdirSync(`${h.dir}/run/refresh.lock`, { recursive: true });
  writeFileSync(`${h.dir}/run/refresh.lock/pid`, `${process.pid}\n`);
  const r = h.run('refresh.sh', ['normal']);
  assert.equal(r.status, 75);
  assert.doesNotMatch(h.commands(), /curl/);
});

test('USB depolama modunda hiçbir şey yazılmaz', () => {
  const h = harness({ env: { STUB_USERSTORE: '0' } });
  const r = h.run('refresh.sh', ['normal']);
  assert.equal(r.status, 1);
  assert.equal(existsSync(h.target), false);
});

// --- Zamanlayıcı ---------------------------------------------------------------

test('zamanlayıcı açılışta yeniler, sonraki anı yazar ve alarmı hemen kurar', () => {
  const h = harness({ env: { STUB_EPOCH: '1000000', STUB_HMS: '12:00:00' } });
  writeFileSync(`${h.base}/enabled`, '');
  const r = h.run('maarifd.sh');
  assert.equal(r.status, 0, r.stderr + h.log());
  assert.match(readFileSync(h.target, 'utf8'), /FRESH/);
  assert.equal(h.state('next_due'), String(1000000 + 3600));   // 13:00
  assert.equal(h.state('fails'), '0');
  assert.match(h.commands(), /setprop -i com\.lab126\.powerd rtcWakeup 3600/);
  assert.ok(existsSync(`${h.dir}/status.txt`), 'durum dosyası yazılmalı');
});

test('uykuya geçiş sinyali yakalanınca kalan süre için alarm kurulur', () => {
  const h = harness({ env: { STUB_EPOCH: '1000000', STUB_HMS: '12:00:00' } });
  writeFileSync(`${h.base}/enabled`, '');
  h.run('maarifd.sh');
  assert.match(h.log(), /uykuya geçiyor; \d+s sonra uyanacak \(readyToSuspend 10\)/);
});

test('başarısız yenileme kısa aralıkla tekrar denenir', () => {
  const h = harness({ env: { STUB_EPOCH: '1000000', STUB_HMS: '12:00:00', STUB_CURL_FAIL: '1' } });
  writeFileSync(`${h.base}/enabled`, '');
  h.run('maarifd.sh');
  assert.equal(h.state('next_due'), String(1000000 + 300));
  assert.equal(h.state('fails'), '1');
  assert.match(h.commands(), /rtcWakeup 300/);
});

test('yenileme sürerken uykuya girilirse kısa süre sonra uyanılır', () => {
  const h = harness();
  mkdirSync(`${h.dir}/run/refresh.lock`, { recursive: true });
  const r = h.sh(`
    SUSPEND_RETRY=90
    eval "$(sed -n '/^seconds_until_due()/,/^}/p' "${ext}/bin/maarifd.sh")"
    seconds_until_due`);
  assert.equal(r.stdout.trim(), '90');
});

// --- Kurulum ---------------------------------------------------------------------

test('kurulum upstart işini kurar, kökü salt-okunur geri alır ve başlatır', () => {
  const h = harness();
  const r = h.run('install.sh');
  assert.equal(r.status, 0, r.stderr + h.log());
  assert.equal(readFileSync(`${h.dir}/upstart/maarif.conf`, 'utf8'), read('bin/maarif.conf'));
  assert.ok(existsSync(`${h.base}/enabled`));
  const cmds = h.commands();
  assert.ok(cmds.indexOf('mntroot rw') < cmds.indexOf('mntroot ro'));
  assert.match(cmds, /start maarif/);
  assert.match(readFileSync(h.target, 'utf8'), /FALLBACK/, 'ekran boşsa yedek görsel konmalı');
});

test('kaldırma durdurur ve upstart işini siler', () => {
  const h = harness();
  h.run('install.sh');
  const r = h.run('uninstall.sh');
  assert.equal(r.status, 0);
  assert.equal(existsSync(`${h.dir}/upstart/maarif.conf`), false);
  assert.equal(existsSync(`${h.base}/enabled`), false);
  assert.match(h.commands(), /stop maarif/);
});
