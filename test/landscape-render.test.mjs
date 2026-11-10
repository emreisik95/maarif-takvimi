import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as render from '../src/render.js';
import { svgToPng } from '../src/raster.js';
import { getRumi } from '../src/hijri.js';
import { getQuoteOfDay } from '../src/quotes.js';
import { getMenu } from '../src/menu.js';
import { cleanWiki, parseEvent, pickEvent } from '../src/onthisday.js';

const model = {
  effective: { year: 2026, month: 11, day: 10 },
  weekdayName: 'SALI',
  monthName: 'KASIM',
  dayOfYear: 314,
  hicri: { yil: 1448, ayAdi: 'Cemaziyelevvel', gun: 30 },
  rumi: { yil: 1442, ayAdi: 'Teşrinievvel', gun: 28 },
  hizir: { tur: 'Kasım', gun: 3 },
  quote: 'Dost başa, düşman ayağa bakar.',
  quoteSource: 'Atasözü',
  names: { girl: 'Defne', boy: 'Kerem' },
  menu: { corba: 'Tarhana çorbası', ana: 'Kuru fasulye', yaninda: 'Pirinç pilavı', tatli: 'Ayva tatlısı' },
  history: {
    special: "10 Kasım Atatürk'ü Anma Günü",
    event: { year: '1953', text: "Atatürk'ün naaşı Anıtkabir'e nakledildi." },
  },
  weather: {
    ok: true, ikon: 'sun', durum: 'Açık', gunduz: 18, gece: 9, nem: 60, ruzgar: 12,
    gunDogumu: '07:40', gunBatimi: '18:00', gunduzSuresi: '10 sa 20 dk',
  },
  events: [
    { time: '09:00', title: 'Proje değerlendirme toplantısı' },
    { time: '12:30', title: 'Öğle yemeği' },
  ],
  now: { hour: 10, minute: 8, second: 0 },
  rolled: false,
};

test('yatay maarif yaprağı tüm bölümleri tek sayfada gösterir', () => {
  for (const variant of render.LANDSCAPE_VARIANTS) {
    const svg = render.buildLandscapeSVG(model, variant);
    assert.match(svg, /<svg[^>]*width="800"[^>]*height="600"/);
    for (const text of ['KASIM', '>10<', 'SALI', 'Rumi 28 Teşrinievvel 1442', 'Hicri 30 Cemaziyelevvel 1448',
      'TARİHTE BUGÜN', "Atatürk'ü Anma Günü", 'GÜNÜN MENÜSÜ', 'Kuru fasulye', 'Defne · Kerem',
      'Gün doğumu', '07:40', 'Dost başa, düşman ayağa bakar.', '— Atasözü', 'Açık']) {
      assert.ok(svg.includes(text.replace(/'/g, '&#39;')) || svg.includes(text), `${variant}: ${text}`);
    }
    if (variant === 'date-focus') assert.doesNotMatch(svg, /AJANDASI/);
    else assert.match(svg, /Proje değerlendirme/);
    assert.match(svg, new RegExp(`data-layout="${variant}"`));
  }
});

test('veri yoksa bölümler boş kalır ama sayfa çizilir', () => {
  const svg = render.buildLandscapeSVG({ ...model, history: { event: null, special: null }, menu: null, quoteSource: '' }, 'date-focus');
  assert.match(svg, /TARİHTE BUGÜN/);
  assert.doesNotMatch(svg, /— Atasözü/);
});

test('yatay görsel 800x600 gri PNG olarak basılır', () => {
  const png = svgToPng(render.buildLandscapeSVG(model, 'agenda-focus'), 800);
  assert.equal(png.readUInt32BE(16), 800);
  assert.equal(png.readUInt32BE(20), 600);
  assert.equal(png[25], 0);
});

test('ajanda boşsa tarih odaklı düzen seçilir', () => {
  assert.equal(render.selectLandscapeVariant({ ...model, events: [] }), 'date-focus');
  assert.equal(render.selectLandscapeVariant(model), 'agenda-focus');
});

test('Rumi tarih Jülyen takviminden ve 1 Mart yılbaşıyla hesaplanır', () => {
  assert.deepEqual(getRumi({ year: 2026, month: 11, day: 10 }), { gun: 28, ay: 10, ayAdi: 'Teşrinievvel', yil: 1442 });
  assert.equal(getRumi({ year: 2026, month: 3, day: 13 }).yil, 1441);
  assert.deepEqual(getRumi({ year: 2026, month: 3, day: 14 }), { gun: 1, ay: 3, ayAdi: 'Mart', yil: 1442 });
});

test('günün sözü kaynaklı gelir ve yıl içinde tekrar etmez', () => {
  const q = getQuoteOfDay('2026-11-10');
  assert.ok(q.text && q.source);
  const seen = new Set();
  for (let i = 0; i < 250; i++) seen.add(getQuoteOfDay(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)).text);
  assert.equal(seen.size, 250);
  assert.deepEqual(getQuoteOfDay('2026-11-10'), q, 'aynı gün aynı söz');
});

test('menü mevsime uygun ve güne göre sabit', () => {
  const kis = getMenu({ year: 2026, month: 1, day: 5 });
  assert.ok(kis.corba && kis.ana && kis.yaninda && kis.tatli);
  assert.deepEqual(getMenu({ year: 2026, month: 1, day: 5 }), kis);
  assert.notDeepEqual(getMenu({ year: 2026, month: 1, day: 6 }), kis);
});

test('Vikipedi satırları düz metne çevrilir ve kısa olay seçilir', () => {
  const line = cleanWiki("[[1938]] - [[Mustafa Kemal Atatürk|Atatürk]], ''Dolmabahçe''de öldü.<ref>x</ref>");
  assert.equal(line, '1938 - Atatürk, Dolmabahçede öldü.');
  assert.deepEqual(parseEvent(line), { year: '1938', text: 'Atatürk, Dolmabahçede öldü.' });
  const pick = pickEvent([{ year: '1', text: 'Roma kuruldu' }, { year: '2', text: 'Osmanlı donanması' }], 's');
  assert.equal(pick.year, '2', 'Türkiye ile ilgili olay öncelikli');
});
