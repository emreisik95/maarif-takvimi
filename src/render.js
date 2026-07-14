// Saatli Maarif Takvimi SVG üreticisi — 600x800 e-ink kanvas.
// Referans mockup birebir: üst bilgi + analog saat + AY + dev gün no + GÜN adı,
// sol Google Takvim kutusu, sağ hava durumu kutusu, altta günün sözü.

const W = 600;
const H = 800;

// Büyük tarih öğeleri (ay adı, gün no, gün adı) fontu — condensed grotesk.
const DISPLAY = 'Bebas Neue';
const DISPLAY_EM = 0.44; // Bebas Neue ~0.44 em/karakter

// Kişiselleştirilebilir metinler (bkz. .env.example)
const HEADER_TEXT = process.env.HEADER_TEXT || 'Büyük saatli Maarif takvimi';
const FOOTER_TEXT = process.env.FOOTER_TEXT || 'F. 18—2';
// "|" ile satırlara bölünür
const WEATHER_LABEL = (process.env.WEATHER_LABEL || 'Muğla|Ortaköy|Hava').split('|').slice(0, 3);
const CALENDAR_TITLE = (process.env.CALENDAR_TITLE || 'Google|Takvim').split('|').slice(0, 2);

function esc(s) {
  return String(s ?? '')
    // XML'de geçersiz C0 kontrol karakterlerini at (resvg parse hatasını önler)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function txt(x, y, s, o = {}) {
  const {
    size = 20, family = 'PT Serif', weight = 'normal', style = 'normal',
    anchor = 'middle', fill = '#000', spacing = 0, textLength,
    // 'spacing' = yalnızca harf aralığını ayarla (glif şeklini BOZMA).
    // 'spacingAndGlyphs' glifleri gerer/şişirir; İ->macron gibi kusurlara yol açar.
    adjust = 'spacing',
  } = o;
  const a = [
    `x="${x}"`, `y="${y}"`, `font-family="${family}"`, `font-size="${size}"`,
    `font-weight="${weight}"`, `font-style="${style}"`,
    `text-anchor="${anchor}"`, `fill="${fill}"`,
  ];
  if (spacing) a.push(`letter-spacing="${spacing}"`);
  if (textLength) a.push(`textLength="${textLength}"`, `lengthAdjust="${adjust}"`);
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}

function line(x1, y1, x2, y2, w = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}" stroke-linecap="butt"/>`;
}
function rect(x, y, w, h, sw = 2) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${sw}"/>`;
}

// Metni maxW'ye sığdıran, glifi BOZMAYAN font boyutu (display font oranıyla).
function fitSize(s, maxW, base) {
  const len = Math.max(1, String(s).length);
  return Math.min(base, Math.floor(maxW / (DISPLAY_EM * len)));
}
// PT Serif (bold) için aynı mantık — ~0.52 em/karakter.
function fitSerif(s, maxW, base) {
  const len = Math.max(1, String(s).length);
  return Math.min(base, Math.floor(maxW / (0.52 * len)));
}
// Kod noktası bazlı kırpma (yüzey ikili karakterleri/emojiyi ortadan bölmez).
function clip(s, n) {
  const arr = Array.from(String(s ?? ''));
  return arr.length > n ? arr.slice(0, n - 1).join('') + '…' : arr.join('');
}

// Etkinlik başlığını en fazla 2 satıra kelime sınırından sar.
function wrapTitle(t, maxChars) {
  const words = String(t).split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) {
      lines[lines.length - 1] = clip(w, maxChars);
    } else if (cur.length + 1 + w.length <= maxChars) {
      lines[lines.length - 1] = cur + ' ' + w;
    } else if (lines.length < 2) {
      lines.push(clip(w, maxChars));
    } else {
      lines[1] = clip(cur + ' ' + w, maxChars);
      break;
    }
  }
  return lines.filter(Boolean);
}

// "[Kraken Test Deadline] Last Chance ..." → köşeli etiket işin özü; onu göster.
function displayTitle(t) {
  const m = String(t).match(/^\[([^\]]{4,})\]/);
  return m ? m[1].trim() : String(t);
}

// --- Analog saat (mockup gibi sade: çentiksiz) ---
function clock(cx, cy, r, hour, minute) {
  const p = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#000" stroke-width="3"/>`];
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30) * Math.PI / 180;
    const rr = r * 0.78;
    p.push(txt(cx + rr * Math.sin(a), cy - rr * Math.cos(a) + 4.5, String(n),
      { size: 12, family: 'PT Serif', weight: 'bold' }));
  }
  const ha = ((hour % 12) * 30 + minute * 0.5) * Math.PI / 180;
  p.push(line(cx, cy, cx + r * 0.48 * Math.sin(ha), cy - r * 0.48 * Math.cos(ha), 3.6));
  const ma = (minute * 6) * Math.PI / 180;
  p.push(line(cx, cy, cx + r * 0.74 * Math.sin(ma), cy - r * 0.74 * Math.cos(ma), 2.4));
  p.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="#000"/>`);
  return p.join('');
}

// --- Hava ikonları ---
function cloudPath(cx, cy, s) {
  const w = 34 * s, h = 20 * s;
  const x = cx - w / 2, y = cy - h / 2;
  return `<path d="M ${x + w * 0.22} ${y + h}
    a ${h * 0.5} ${h * 0.5} 0 0 1 ${-h * 0.02} ${-h * 0.62}
    a ${h * 0.62} ${h * 0.62} 0 0 1 ${w * 0.42} ${-h * 0.38}
    a ${h * 0.5} ${h * 0.5} 0 0 1 ${w * 0.4} ${h * 0.2}
    a ${h * 0.45} ${h * 0.45} 0 0 1 ${-w * 0.02} ${h * 0.78}
    Z" fill="#fff" stroke="#000" stroke-width="${2 * s}"/>`;
}
// Kar tanesi — fonta bağlı glif yerine çizilmiş 3 çizgili yıldız (tofu önler)
function snowflake(cx, cy, r) {
  let p = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * 60) * Math.PI / 180;
    p += line(cx - r * Math.cos(a), cy - r * Math.sin(a),
      cx + r * Math.cos(a), cy + r * Math.sin(a), 1.6);
  }
  return p;
}
function sunRays(cx, cy, r) {
  let p = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    p += line(cx + (r + 3) * Math.cos(a), cy + (r + 3) * Math.sin(a),
      cx + (r + 12) * Math.cos(a), cy + (r + 12) * Math.sin(a), 2.6);
  }
  return p;
}
function weatherIcon(type, cx, cy) {
  switch (type) {
    case 'sun':
      return `<circle cx="${cx}" cy="${cy}" r="15" fill="#000"/>` + sunRays(cx, cy, 15);
    case 'partly':
      return `<circle cx="${cx - 10}" cy="${cy - 8}" r="11" fill="#000"/>` +
        sunRays(cx - 10, cy - 8, 11) + cloudPath(cx + 5, cy + 6, 1.0);
    case 'cloud':
      return cloudPath(cx, cy, 1.2);
    case 'rain':
      return cloudPath(cx, cy - 6, 1.0) +
        [-10, 0, 10].map((dx) => line(cx + dx, cy + 12, cx + dx - 3, cy + 23, 2.4)).join('');
    case 'snow':
      return cloudPath(cx, cy - 6, 1.0) +
        [-11, 0, 11].map((dx) => snowflake(cx + dx, cy + 20, 5)).join('');
    case 'storm':
      return cloudPath(cx, cy - 6, 1.0) +
        `<path d="M ${cx - 2} ${cy + 10} L ${cx - 9} ${cy + 23} L ${cx - 1} ${cy + 23} L ${cx - 7} ${cy + 34} L ${cx + 9} ${cy + 19} L ${cx} ${cy + 19} Z" fill="#000"/>`;
    case 'fog':
      return cloudPath(cx, cy - 4, 1.0) +
        [15, 21, 27].map((dy) => line(cx - 16, cy + dy, cx + 16, cy + dy, 2.1)).join('');
    default:
      return cloudPath(cx, cy, 1.15);
  }
}

// Durum metnini kutuya sığdır (gerekirse 2 satır)
function wrapDurum(s) {
  s = String(s ?? '—');
  if (s.length <= 9 || !s.includes(' ')) return [s];
  const w = s.split(' ');
  return [w[0], w.slice(1).join(' ')];
}

// --- Sol kutu: Google Takvim ---
function calendarBox(model) {
  const bx = 28, by = 298, bw = 104, bh = 352, cx = bx + bw / 2;
  const p = [rect(bx, by, bw, bh, 2.5)];
  CALENDAR_TITLE.forEach((l, i) => {
    p.push(txt(cx, by + 26 + i * 21, l, { size: fitSerif(l, bw - 14, 18), weight: 'bold' }));
  });
  p.push(line(bx + 10, by + 59, bx + bw - 10, by + 59, 1.6));

  // 19:00 sonrası yarının etkinlikleri gösterilir — etiketle belirt.
  const gunEtiketi = model.rolled ? 'Yarın' : 'Bugün';
  p.push(txt(cx, by + 80, gunEtiketi, { size: 15, weight: 'bold', style: 'italic' }));

  const evs = model.events || [];
  if (!evs.length) {
    p.push(txt(cx, by + 165, `${gunEtiketi} için`, { size: 16 }));
    p.push(txt(cx, by + 187, 'etkinlik yok', { size: 16 }));
  } else {
    // Saat 18px bold + başlık 2 satıra kadar 12px — 10 karakterlik kırpma yerine
    // ~30 karakter okunur başlık.
    const shown = evs.slice(0, 4);
    const block = shown.length <= 3 ? 78 : 62;
    shown.forEach((e, i) => {
      const y = by + 106 + i * block;
      p.push(txt(cx, y, e.time, { size: 18, weight: 'bold' }));
      const lines = wrapTitle(displayTitle(e.title), 15);
      lines.forEach((l, j) => {
        p.push(txt(cx, y + 16 + j * 14, l, { size: 12 }));
      });
    });
  }
  return p.join('');
}

// --- Sağ kutu: Hava durumu ---
function weatherBox(model) {
  const bx = 468, by = 298, bw = 104, bh = 352, cx = bx + bw / 2;
  const w = model.weather;
  const p = [rect(bx, by, bw, bh, 2.5)];
  WEATHER_LABEL.forEach((l, i) => {
    p.push(txt(cx, by + 24 + i * 21, l, { size: fitSerif(l, bw - 14, 18), weight: 'bold' }));
  });

  p.push(weatherIcon(w.ikon, cx, by + 112));

  const dl = wrapDurum(w.durum);
  if (dl.length === 1) {
    p.push(txt(cx, by + 162, dl[0], { size: 18, weight: 'bold' }));
  } else {
    p.push(txt(cx, by + 152, dl[0], { size: 15, weight: 'bold' }));
    p.push(txt(cx, by + 172, dl[1], { size: 15, weight: 'bold' }));
  }

  // Kutu içinde kal: uzun değerlerde (örn. "Gündüz -12°") font otomatik küçülür.
  const innerW = bw - 10;
  const gunduzS = `Gündüz ${w.gunduz == null ? '—' : `${w.gunduz}°`}`;
  const geceS = `Gece ${w.gece == null ? '—' : `${w.gece}°`}`;
  p.push(txt(cx, by + 198, gunduzS, { size: fitSerif(gunduzS, innerW, 15), weight: 'bold' }));
  p.push(txt(cx, by + 220, geceS, { size: fitSerif(geceS, innerW, 15), weight: 'bold' }));
  p.push(line(bx + 12, by + 238, bx + bw - 12, by + 238, 1.3));

  const nem = w.nem == null ? '—' : `%${w.nem}`;
  p.push(txt(cx, by + 262, `Nem ${nem}`, { size: 17 }));
  p.push(txt(cx, by + 286, 'Rüzgar', { size: 16 }));
  const ruz = w.ruzgar == null ? '—' : `${w.ruzgar} km/s`;
  p.push(txt(cx, by + 306, ruz, { size: 16 }));
  return p.join('');
}

// --- Ana SVG ---
export function buildSVG(model) {
  const { now } = model;
  const s = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`];
  s.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

  // Başlık
  s.push(txt(W / 2, 32, HEADER_TEXT, { size: fitSerif(HEADER_TEXT, 540, 23), weight: 'bold', spacing: 2.5 }));

  // Çerçeve (çift çizgi)
  s.push(rect(15, 44, W - 30, H - 58, 3.5));
  s.push(rect(21, 50, W - 42, H - 70, 1.3));

  // --- Üst bilgi ---
  s.push(txt(120, 92, `Miladi ${model.effective.year}`, { size: 22, weight: 'bold' }));
  s.push(txt(120, 120, `Ay ${model.effective.month}`, { size: 22, weight: 'bold' }));
  s.push(clock(300, 104, 44, now.hour, now.minute));
  s.push(txt(482, 84, `Hicri ${model.hicri.yil}`, { size: 22, weight: 'bold' }));
  s.push(txt(482, 110, model.hicri.ayAdi, { size: 22, weight: 'bold' }));
  s.push(txt(482, 136, String(model.hicri.gun), { size: 22, weight: 'bold' }));

  s.push(line(30, 152, 256, 152, 3));
  s.push(line(344, 152, 570, 152, 3));

  s.push(txt(145, 182, `Yıl ${model.effective.year}   Ay ${model.effective.month}`, { size: 20, weight: 'bold' }));
  s.push(txt(455, 182, `Gün ${model.dayOfYear}   ${model.hizir.tur} ${model.hizir.gun}`, { size: 20, weight: 'bold' }));

  s.push(line(30, 196, 570, 196, 4));

  // --- Ay adı --- Harf harf eşit hücrelere bas: textLength'in son harf sonrasına
  // da boşluk ekleyip mürekkebi sola kaydırma kusuru olmadan tam ortalanır
  // (mockup'taki "T E M M U Z" dizgisi).
  const monChars = Array.from(String(model.monthName));
  const monSpan = Math.min(508, Math.round(DISPLAY_EM * 96 * monChars.length * 1.75));
  const monCell = monSpan / monChars.length;
  monChars.forEach((ch, i) => {
    const x = W / 2 - monSpan / 2 + monCell * (i + 0.5);
    s.push(txt(x, 284, ch, { family: DISPLAY, size: 96 }));
  });

  // --- Yan kutular ---
  s.push(calendarBox(model));
  s.push(weatherBox(model));

  // --- Dev gün numarası (doğal genişlik; kutular arasına sığar, gerilmez) ---
  const dd = String(model.effective.day).padStart(2, '0');
  s.push(txt(W / 2, 606, dd, { family: DISPLAY, size: 380 }));

  // --- Gün adı (uzun adlar için font boyutu küçülür, glif bozulmaz) ---
  // Ç/Ş çengelleri baseline'ın ~0.2em altına iner; çizgiyle çakışmasın diye
  // baseline 700, bölücü 730.
  s.push(txt(W / 2, 700, model.weekdayName,
    { family: DISPLAY, size: fitSize(model.weekdayName, 336, 86) }));

  s.push(line(30, 730, 570, 730, 4));

  // --- Günün sözü --- (kısa: tek satır; uzun: ortadan dengeli 2 satır)
  // Alt bandın (bölücü 730 — iç çerçeve 780) dikey ortasına hizalanır.
  // Mürekkep merkezi ≈ baseline - 0.245*size (cap ~0.7, descender ~0.21).
  const q = model.quote || '';
  const zoneMid = (730 + 780) / 2;
  if (q.length <= 55) {
    const base = q.length <= 30 ? 24 : q.length <= 45 ? 20 : 17;
    const size = fitSerif(q, 508, base);
    s.push(txt(W / 2, Math.round(zoneMid + 0.245 * size), q, { size, weight: 'bold' }));
  } else {
    const mid = Math.floor(q.length / 2);
    let idx = -1;
    for (let d = 0; d < q.length; d++) {
      if (mid - d > 0 && q[mid - d] === ' ') { idx = mid - d; break; }
      if (mid + d < q.length && q[mid + d] === ' ') { idx = mid + d; break; }
    }
    const l1 = idx > 0 ? q.slice(0, idx) : q;
    const l2 = idx > 0 ? q.slice(idx + 1) : '';
    const size = Math.min(16, fitSerif(l1, 500, 16), fitSerif(l2, 430, 16));
    const gap = 20;
    const y1 = Math.round(zoneMid - gap / 2 + 0.245 * size); // iki satırın mürekkep merkezi zoneMid
    s.push(txt(W / 2, y1, l1, { size, weight: 'bold' }));
    if (l2) s.push(txt(W / 2, y1 + gap, l2, { size, weight: 'bold' }));
  }

  // Form no (iç çerçevenin içinde kalır)
  s.push(txt(566, 775, FOOTER_TEXT, { size: 14, weight: 'bold', anchor: 'end' }));

  s.push('</svg>');
  return s.join('\n');
}

// --- 800x600 yatay tasarım seçenekleri ---
// Bunlar seçim önizlemesidir; buildSVG kullanan canlı portre endpoint değişmez.
export const LANDSCAPE_VARIANTS = Object.freeze(['balanced', 'date-focus', 'agenda-focus']);

export function selectLandscapeVariant(model) {
  return (model.events || []).length > 0 ? 'agenda-focus' : 'date-focus';
}

function landscapeHeader(model) {
  const p = [];
  p.push(txt(122, 67, `Miladi ${model.effective.year}`, { size: 19, weight: 'bold' }));
  p.push(txt(122, 92, `Ay ${model.effective.month} · Gün ${model.dayOfYear}`, { size: 17, weight: 'bold' }));
  p.push(clock(400, 82, 35, model.now.hour, model.now.minute));
  p.push(txt(678, 67, `Hicri ${model.hicri.yil}`, { size: 19, weight: 'bold' }));
  p.push(txt(678, 92, `${model.hicri.gun} ${model.hicri.ayAdi}`, { size: 17, weight: 'bold' }));
  p.push(line(28, 128, 772, 128, 3));
  return p.join('');
}

function landscapeCalendarBox(model, x, y, w, h, maxEvents = 4) {
  const p = [rect(x, y, w, h, 2.5)];
  const label = model.rolled ? 'YARININ AJANDASI' : 'BUGÜNÜN AJANDASI';
  p.push(txt(x + w / 2, y + 31, label, {
    size: fitSerif(label, w - 45, 19), weight: 'bold', spacing: 0.4,
  }));
  p.push(line(x + 12, y + 48, x + w - 12, y + 48, 1.5));

  const events = (model.events || []).slice(0, maxEvents);
  if (!events.length) {
    p.push(txt(x + w / 2, y + h / 2, 'Etkinlik yok', { size: 18, style: 'italic' }));
    return p.join('');
  }

  const rowH = (h - 64) / Math.max(maxEvents, events.length);
  const narrow = w < 210;
  const titleChars = narrow
    ? Math.max(18, Math.floor((w - 30) / 6.5))
    : Math.max(16, Math.floor((w - 78) / 6.5));
  events.forEach((event, i) => {
    const top = y + 65 + i * rowH;
    p.push(`<g aria-label="${esc(`${event.time} ${event.title}`)}">`);
    p.push(txt(x + 17, top + (narrow ? 15 : 20), event.time, {
      size: 16, weight: 'bold', anchor: 'start',
    }));
    const lines = wrapTitle(displayTitle(event.title), titleChars);
    lines.forEach((title, j) => {
      const titleX = narrow ? x + 17 : x + 73;
      const titleY = narrow ? top + 34 + j * 15 : top + 18 + j * 17;
      const titleW = narrow ? w - 32 : w - 87;
      p.push(txt(titleX, titleY, title, {
        size: fitSerif(title, titleW, narrow ? 13 : 15), anchor: 'start',
        weight: j === 0 ? 'bold' : 'normal',
      }));
    });
    if (i < events.length - 1) p.push(line(x + 14, top + rowH - 5, x + w - 14, top + rowH - 5, 0.8));
    p.push('</g>');
  });
  return p.join('');
}

function landscapeDateBox(model, x, y, w, h, focus = false) {
  const p = [rect(x, y, w, h, focus ? 3.5 : 2.5)];
  const compact = h < 260;
  const monthSize = fitSize(model.monthName, w - 30, compact ? 47 : focus ? 55 : 47);
  p.push(txt(x + w / 2, y + (compact ? 42 : 49), model.monthName, {
    family: DISPLAY, size: monthSize, spacing: 2,
  }));
  p.push(line(x + 16, y + (compact ? 53 : 61), x + w - 16, y + (compact ? 53 : 61), 1.5));

  const day = String(model.effective.day).padStart(2, '0');
  const daySize = compact
    ? Math.min(128, Math.floor(w * 0.7))
    : Math.min(focus ? 264 : 220, Math.floor(h * 0.7), Math.floor(w * 0.93));
  p.push(txt(x + w / 2, y + (compact ? 151 : h * 0.73), day, { family: DISPLAY, size: daySize }));
  p.push(txt(x + w / 2, y + h - (compact ? 20 : 30), model.weekdayName, {
    family: DISPLAY, size: fitSize(model.weekdayName, w - 30, compact ? 34 : focus ? 54 : 43), spacing: 1,
  }));
  p.push(txt(x + w / 2, y + h - (compact ? 7 : 10), `${model.hizir.tur} ${model.hizir.gun}`, {
    size: 13, weight: 'bold',
  }));
  return p.join('');
}

function landscapeWeatherBox(model, x, y, w, h) {
  const weather = model.weather;
  const p = [rect(x, y, w, h, 2.5)];
  const label = WEATHER_LABEL.join(' · ');
  p.push(txt(x + w / 2, y + 30, label, {
    size: fitSerif(label, w - 18, 18), weight: 'bold', spacing: 0.5,
  }));
  p.push(line(x + 12, y + 47, x + w - 12, y + 47, 1.5));
  p.push(weatherIcon(weather.ikon, x + w / 2, y + 91));
  p.push(txt(x + w / 2, y + 139, weather.durum, {
    size: fitSerif(weather.durum, w - 20, 21), weight: 'bold',
  }));

  const day = weather.gunduz == null ? '—' : `${weather.gunduz}°`;
  const night = weather.gece == null ? '—' : `${weather.gece}°`;
  p.push(txt(x + w / 2, y + 174, `Gündüz ${day}  ·  Gece ${night}`, {
    size: fitSerif(`Gündüz ${day}  ·  Gece ${night}`, w - 18, 17), weight: 'bold',
  }));
  p.push(line(x + 18, y + 194, x + w - 18, y + 194, 1));

  const humidity = weather.nem == null ? '—' : `%${weather.nem}`;
  const wind = weather.ruzgar == null ? '—' : `${weather.ruzgar} km/s`;
  p.push(txt(x + w / 2, y + 225, `Nem ${humidity}`, { size: 17 }));
  p.push(txt(x + w / 2, y + 253, `Rüzgar ${wind}`, {
    size: fitSerif(`Rüzgar ${wind}`, w - 18, 17),
  }));
  p.push(txt(x + w / 2, y + h - 27, `${model.effective.day} ${model.monthName.toLocaleLowerCase('tr-TR')}`, {
    size: 15, style: 'italic', weight: 'bold',
  }));
  return p.join('');
}

function landscapeWeatherStrip(model, x, y, w, h) {
  const weather = model.weather;
  const p = [rect(x, y, w, h, 2.5)];
  p.push(weatherIcon(weather.ikon, x + 52, y + h / 2));
  p.push(txt(x + 94, y + 34, weather.durum, {
    size: fitSerif(weather.durum, 120, 21), anchor: 'start', weight: 'bold',
  }));
  p.push(txt(x + 94, y + 61, WEATHER_LABEL.join(' · '), {
    size: fitSerif(WEATHER_LABEL.join(' · '), 126, 14), anchor: 'start',
  }));
  const day = weather.gunduz == null ? '—' : `${weather.gunduz}°`;
  const night = weather.gece == null ? '—' : `${weather.gece}°`;
  const humidity = weather.nem == null ? '—' : `%${weather.nem}`;
  const wind = weather.ruzgar == null ? '—' : `${weather.ruzgar} km/s`;
  p.push(line(x + 226, y + 13, x + 226, y + h - 13, 1.2));
  const rightWidth = w - 260;
  p.push(txt(x + 248, y + 29, `Gündüz ${day}`, {
    size: fitSerif(`Gündüz ${day}`, rightWidth, 15), anchor: 'start', weight: 'bold',
  }));
  p.push(txt(x + 248, y + 51, `Gece ${night}`, {
    size: fitSerif(`Gece ${night}`, rightWidth, 15), anchor: 'start', weight: 'bold',
  }));
  p.push(txt(x + 248, y + 74, `${humidity} · ${wind}`, {
    size: fitSerif(`${humidity} · ${wind}`, rightWidth, 13), anchor: 'start',
  }));
  return p.join('');
}

function landscapeQuote(model) {
  const quote = String(model.quote || '');
  const p = [line(28, 493, 772, 493, 3)];
  if (quote.length <= 68) {
    p.push(txt(400, 538, quote, {
      size: fitSerif(quote, 690, 23), weight: 'bold', style: 'italic',
    }));
  } else {
    const midpoint = Math.floor(quote.length / 2);
    const split = quote.lastIndexOf(' ', midpoint);
    const first = split > 0 ? quote.slice(0, split) : quote;
    const second = split > 0 ? quote.slice(split + 1) : '';
    const size = Math.min(17, fitSerif(first, 700, 17), fitSerif(second, 650, 17));
    p.push(txt(400, 525, first, { size, weight: 'bold', style: 'italic' }));
    if (second) p.push(txt(400, 548, second, { size, weight: 'bold', style: 'italic' }));
  }
  p.push(txt(766, 574, FOOTER_TEXT, { size: 12, weight: 'bold', anchor: 'end' }));
  return p.join('');
}

export function buildLandscapeSVG(model, variant = 'balanced') {
  if (!LANDSCAPE_VARIANTS.includes(variant)) throw new Error(`Unknown landscape layout: ${variant}`);

  const s = [`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-layout="${variant}">`];
  s.push('<rect x="0" y="0" width="800" height="600" fill="#ffffff"/>');
  s.push(txt(400, 25, HEADER_TEXT, { size: fitSerif(HEADER_TEXT, 700, 21), weight: 'bold', spacing: 2 }));
  s.push(rect(12, 35, 776, 550, 3.5));
  s.push(rect(18, 41, 764, 538, 1.2));
  s.push(landscapeHeader(model));

  if (variant === 'balanced') {
    s.push(landscapeCalendarBox(model, 30, 145, 225, 330));
    s.push(landscapeDateBox(model, 270, 145, 260, 330));
    s.push(landscapeWeatherBox(model, 545, 145, 225, 330));
  } else if (variant === 'date-focus') {
    s.push(landscapeDateBox(model, 30, 145, 500, 330, true));
    s.push(landscapeWeatherBox(model, 545, 145, 225, 330));
  } else {
    s.push(landscapeCalendarBox(model, 30, 145, 350, 330, 5));
    s.push(landscapeDateBox(model, 395, 145, 375, 215, true));
    s.push(landscapeWeatherStrip(model, 395, 375, 375, 100));
  }

  s.push(landscapeQuote(model));
  s.push('</svg>');
  return s.join('\n');
}
