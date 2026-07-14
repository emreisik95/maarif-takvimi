import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as render from '../src/render.js';
import { svgToPng } from '../src/raster.js';

const model = {
  effective: { year: 2026, month: 7, day: 14 },
  weekdayName: 'SALI',
  monthName: 'TEMMUZ',
  dayOfYear: 195,
  hicri: { yil: 1448, ayAdi: 'Muharrem', gun: 29 },
  hizir: { tur: 'Hızır', gun: 70 },
  quote: 'Vakit nakittir.',
  weather: { ok: true, ikon: 'sun', durum: 'Açık', gunduz: 32, gece: 20, nem: 42, ruzgar: 17 },
  events: [
    { time: '09:00', title: 'Proje değerlendirme toplantısı' },
    { time: '12:30', title: 'Öğle yemeği' },
    { time: '16:00', title: 'Tasarım sunumu' },
    { time: '19:30', title: 'Akşam yürüyüşü' },
  ],
  now: { hour: 10, minute: 8, second: 0 },
  rolled: false,
};

test('landscape renderer exposes three selectable 800x600 compositions', () => {
  assert.deepEqual(render.LANDSCAPE_VARIANTS, ['balanced', 'date-focus', 'agenda-focus']);
  assert.equal(typeof render.buildLandscapeSVG, 'function');

  for (const variant of render.LANDSCAPE_VARIANTS) {
    const svg = render.buildLandscapeSVG(model, variant);
    assert.match(svg, /<svg[^>]*width="800"[^>]*height="600"[^>]*viewBox="0 0 800 600"/);
    assert.match(svg, />TEMMUZ</);
    assert.match(svg, />14</);
    assert.match(svg, />SALI</);
    assert.match(svg, /Proje değerlendirme/);
    assert.match(svg, />Açık</);
    assert.match(svg, />Vakit nakittir\.</);
    assert.match(svg, new RegExp(`data-layout="${variant}"`));
  }
});

test('rasterizer can preserve the landscape canvas at 800x600 grayscale', () => {
  assert.equal(typeof render.buildLandscapeSVG, 'function');
  const svg = render.buildLandscapeSVG(model, 'balanced');
  const png = svgToPng(svg, 800);

  assert.equal(png.readUInt32BE(16), 800);
  assert.equal(png.readUInt32BE(20), 600);
  assert.equal(png[24], 8);
  assert.equal(png[25], 0);
});

