import { mkdirSync, writeFileSync } from 'node:fs';
import { buildLandscapeSVG, LANDSCAPE_VARIANTS } from '../src/render.js';
import { svgToPng } from '../src/raster.js';

const model = {
  effective: { year: 2026, month: 7, day: 14 },
  weekdayName: 'SALI',
  monthName: 'TEMMUZ',
  dayOfYear: 195,
  hicri: { yil: 1448, ayAdi: 'Muharrem', gun: 29 },
  hizir: { tur: 'Hızır', gun: 70 },
  quote: 'Bugünün işini yarına bırakma.',
  weather: {
    ok: true, ikon: 'sun', durum: 'Açık', gunduz: 32, gece: 20, nem: 42, ruzgar: 17,
    gunDogumu: '05:52', gunBatimi: '20:24', gunduzSuresi: '14 sa 32 dk',
  },
  events: [
    { time: '09:00', title: 'Proje değerlendirme toplantısı' },
    { time: '11:30', title: 'Tasarım geri bildirimleri' },
    { time: '14:00', title: 'Müşteri görüşmesi' },
    { time: '17:15', title: 'Gün sonu planlaması' },
    { time: '19:30', title: 'Akşam yürüyüşü' },
  ],
  now: { hour: 10, minute: 8, second: 0 },
  rolled: false,
};

mkdirSync('docs/landscape-options', { recursive: true });

for (const variant of LANDSCAPE_VARIANTS) {
  const svg = buildLandscapeSVG(model, variant);
  const png = svgToPng(svg, 800);
  writeFileSync(`docs/landscape-options/${variant}.svg`, svg);
  writeFileSync(`docs/landscape-options/${variant}.png`, png);
  console.log(`${variant}: ${png.length} bytes`);
}
