// Tek seferlik önizleme: verilen an için PNG + SVG üret.
import { writeFileSync } from 'node:fs';
import { assembleModel } from '../src/model.js';
import { buildSVG } from '../src/render.js';
import { svgToPng } from '../src/raster.js';

// 7 Temmuz 2026, 10:08 İstanbul (UTC+3) => 07:08 UTC
// MAARIF_INSTANT_MS env ile override edilebilir (test için).
const instant = process.env.MAARIF_INSTANT_MS
  ? Number(process.env.MAARIF_INSTANT_MS)
  : Date.UTC(2026, 6, 7, 7, 8, 0);

const model = await assembleModel(instant);
console.log('MODEL:', JSON.stringify({
  effective: model.effective, weekday: model.weekdayName, month: model.monthName,
  dayOfYear: model.dayOfYear, hicri: model.hicri, hizir: model.hizir,
  quote: model.quote, weather: model.weather, events: model.events,
  calendarSource: model.calendarSource, now: model.now, rolled: model.rolled,
}, null, 2));

const svg = buildSVG(model);
writeFileSync(process.argv[2] || '/tmp/maarif.svg', svg);
const png = svgToPng(svg);
writeFileSync(process.argv[3] || '/tmp/maarif.png', png);
console.log('PNG bytes:', png.length);
