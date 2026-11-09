// Yatay (landscape) düzen — 800x600 tasarlanır, Kindle'ın dikey 600x800
// paneline 90° döndürülerek basılır (cihaz yan tutulur).
// Yatayda yan kutular 230px genişler: etkinlik/hava yazıları uzaktan okunur.
import {
  DISPLAY, HEADER_TEXT, FOOTER_TEXT, WEATHER_LABEL, CALENDAR_TITLE,
  txt, line, rect, fitSize, fitSerif, wrapTitle, displayTitle, clock,
  weatherIcon, wrapDurum,
} from './render.js';

const W = 800;
const H = 600;
const BOX_Y = 166, BOX_W = 230, BOX_H = 352;
const CAL_X = 28, WX_X = W - 28 - BOX_W;

function calendarBox(model) {
  const bx = CAL_X, by = BOX_Y, bw = BOX_W, bh = BOX_H, cx = bx + bw / 2;
  const p = [rect(bx, by, bw, bh, 2.5)];
  const title = CALENDAR_TITLE.join(' ');
  p.push(txt(cx, by + 31, title, { size: fitSerif(title, bw - 16, 23), weight: 'bold' }));
  p.push(line(bx + 12, by + 46, bx + bw - 12, by + 46, 1.6));

  const gunEtiketi = model.rolled ? 'Yarın' : 'Bugün';
  p.push(txt(cx, by + 72, gunEtiketi, { size: 20, weight: 'bold', style: 'italic' }));

  const evs = model.events || [];
  if (!evs.length) {
    p.push(txt(cx, by + 190, 'Etkinlik yok', { size: 26, weight: 'bold' }));
    return p.join('');
  }
  // En fazla 3 etkinlik: saat 30px + başlık 2 satıra kadar 19px kalın.
  const shown = evs.slice(0, 3);
  const extra = evs.length - shown.length;
  shown.forEach((e, i) => {
    const y = by + 108 + i * 82;
    p.push(txt(cx, y, e.time, { size: 30, weight: 'bold' }));
    wrapTitle(displayTitle(e.title), 20).forEach((l, j) => {
      p.push(txt(cx, y + 24 + j * 21, l, { size: fitSerif(l, bw - 16, 19), weight: 'bold' }));
    });
  });
  if (extra > 0) p.push(txt(cx, by + bh - 10, `+${extra} etkinlik daha`, { size: 16, style: 'italic', weight: 'bold' }));
  return p.join('');
}

function weatherBox(model) {
  const bx = WX_X, by = BOX_Y, bw = BOX_W, bh = BOX_H, cx = bx + bw / 2;
  const w = model.weather;
  const p = [rect(bx, by, bw, bh, 2.5)];
  const label = WEATHER_LABEL.slice(0, 2).join(' ');
  p.push(txt(cx, by + 31, label, { size: fitSerif(label, bw - 16, 23), weight: 'bold' }));
  p.push(line(bx + 12, by + 46, bx + bw - 12, by + 46, 1.6));

  // İkon solda, durum sağda
  p.push(weatherIcon(w.ikon, bx + 52, by + 96));
  const dl = wrapDurum(w.durum);
  const dx = bx + 152;
  if (dl.length === 1) {
    p.push(txt(dx, by + 104, dl[0], { size: fitSerif(dl[0], 136, 24), weight: 'bold' }));
  } else {
    p.push(txt(dx, by + 93, dl[0], { size: fitSerif(dl[0], 136, 20), weight: 'bold' }));
    p.push(txt(dx, by + 116, dl[1], { size: fitSerif(dl[1], 136, 20), weight: 'bold' }));
  }

  // Gündüz sıcaklığı: dev rakam
  const gunduz = w.gunduz == null ? '—' : `${w.gunduz}°`;
  p.push(txt(cx, by + 238, gunduz, { family: DISPLAY, size: fitSize(gunduz, bw - 20, 112) }));
  const geceS = `Gece ${w.gece == null ? '—' : `${w.gece}°`}`;
  p.push(txt(cx, by + 272, geceS, { size: 24, weight: 'bold' }));
  p.push(line(bx + 14, by + 290, bx + bw - 14, by + 290, 1.3));

  const nem = w.nem == null ? '—' : `%${w.nem}`;
  const ruz = w.ruzgar == null ? '—' : `${w.ruzgar} km/s`;
  p.push(txt(cx, by + 316, `Nem ${nem}`, { size: 20, weight: 'bold' }));
  p.push(txt(cx, by + 341, `Rüzgar ${ruz}`, { size: fitSerif(`Rüzgar ${ruz}`, bw - 16, 20), weight: 'bold' }));
  return p.join('');
}

// İçeriği (800x600) üretir; döndürme buildLandscapeSVG'de.
function content(model) {
  const { now } = model;
  const s = [`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`];

  s.push(txt(W / 2, 32, HEADER_TEXT, { size: fitSerif(HEADER_TEXT, 700, 24), weight: 'bold', spacing: 2.5 }));
  s.push(rect(12, 44, W - 24, H - 56, 3.5));
  s.push(rect(18, 50, W - 36, H - 68, 1.3));

  // --- Üst bant ---
  s.push(txt(170, 92, `Miladi ${model.effective.year}  ·  Ay ${model.effective.month}`, { size: 24, weight: 'bold' }));
  s.push(txt(170, 128, `Gün ${model.dayOfYear}  ·  ${model.hizir.tur} ${model.hizir.gun}`, { size: 22, weight: 'bold' }));
  s.push(clock(W / 2, 103, 46, now.hour, now.minute));
  s.push(txt(630, 84, `Hicri ${model.hicri.yil}`, { size: 22, weight: 'bold' }));
  s.push(txt(630, 110, model.hicri.ayAdi, { size: fitSerif(model.hicri.ayAdi, 240, 22), weight: 'bold' }));
  s.push(txt(630, 136, String(model.hicri.gun), { size: 22, weight: 'bold' }));
  s.push(line(26, 158, W - 26, 158, 4));

  // --- Orta sütun: AY / gün no / GÜN ---
  const monChars = Array.from(String(model.monthName));
  const monSize = 62;
  const monSpan = Math.min(256, Math.round(0.44 * monSize * monChars.length * 1.75));
  const monCell = monSpan / monChars.length;
  monChars.forEach((ch, i) => {
    s.push(txt(W / 2 - monSpan / 2 + monCell * (i + 0.5), 222, ch, { family: DISPLAY, size: monSize }));
  });

  s.push(calendarBox(model));
  s.push(weatherBox(model));

  const dd = String(model.effective.day).padStart(2, '0');
  s.push(txt(W / 2, 436, dd, { family: DISPLAY, size: 248 }));
  s.push(txt(W / 2, 514, model.weekdayName,
    { family: DISPLAY, size: fitSize(model.weekdayName, 256, 60) }));

  s.push(line(26, 528, W - 26, 528, 4));

  // --- Günün sözü ---
  const q = model.quote || '';
  const zoneMid = 553;
  const one = fitSerif(q, 640, 26);
  if (one >= 18) {
    s.push(txt(W / 2, Math.round(zoneMid + 0.245 * one), q, { size: one, weight: 'bold' }));
  } else {
    const mid = Math.floor(q.length / 2);
    let idx = -1;
    for (let d = 0; d < q.length; d++) {
      if (mid - d > 0 && q[mid - d] === ' ') { idx = mid - d; break; }
      if (mid + d < q.length && q[mid + d] === ' ') { idx = mid + d; break; }
    }
    const l1 = idx > 0 ? q.slice(0, idx) : q;
    const l2 = idx > 0 ? q.slice(idx + 1) : '';
    const size = Math.min(19, fitSerif(l1, 640, 19), fitSerif(l2, 600, 19));
    const y1 = Math.round(zoneMid - 10 + 0.245 * size);
    s.push(txt(W / 2, y1, l1, { size, weight: 'bold' }));
    if (l2) s.push(txt(W / 2, y1 + 21, l2, { size, weight: 'bold' }));
  }
  s.push(txt(W - 28, 574, FOOTER_TEXT, { size: 13, weight: 'bold', anchor: 'end' }));
  return s.join('\n');
}

// rotate: 90 = yatay sayfanın üstü panelin SAĞ kenarına (Kindle saat yönünün
// tersine yan tutulur, ana tuş solda); 270 = üstü SOL kenara (ana tuş sağda);
// 0 = döndürmeden 800x600 (önizleme için).
export function buildLandscapeSVG(model, rotate = 90) {
  const body = content(model);
  if (rotate === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${body}\n</svg>`;
  }
  const tf = rotate === 270 ? `translate(0,${W}) rotate(-90)` : `translate(${H},0) rotate(90)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${W}" viewBox="0 0 ${H} ${W}">\n<g transform="${tf}">\n${body}\n</g>\n</svg>`;
}
