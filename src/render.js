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
const WEATHER_LABEL = (process.env.WEATHER_LABEL || 'Muğla|Ortaköy')
  .split('|')
  .map((part) => part.trim())
  .filter((part) => part && part.toLocaleLowerCase('tr-TR') !== 'hava')
  .slice(0, 2);
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
      { size: Math.min(12, Math.round(r * 0.29)), family: 'PT Serif', weight: 'bold' }));
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
// Uzaktan okunurluk: kutular geniş (124px), saat 26px, başlık 16px kalın.
const BOX_Y = 298, BOX_W = 124, BOX_H = 352;
const CAL_X = 26, WX_X = W - 26 - BOX_W;

function calendarBox(model) {
  const bx = CAL_X, by = BOX_Y, bw = BOX_W, bh = BOX_H, cx = bx + bw / 2;
  const p = [rect(bx, by, bw, bh, 2.5)];
  CALENDAR_TITLE.forEach((l, i) => {
    p.push(txt(cx, by + 26 + i * 22, l, { size: fitSerif(l, bw - 14, 20), weight: 'bold' }));
  });
  p.push(line(bx + 10, by + 60, bx + bw - 10, by + 60, 1.6));

  // 19:00 sonrası yarının etkinlikleri gösterilir — etiketle belirt.
  const gunEtiketi = model.rolled ? 'Yarın' : 'Bugün';
  p.push(txt(cx, by + 84, gunEtiketi, { size: 18, weight: 'bold', style: 'italic' }));

  const evs = model.events || [];
  if (!evs.length) {
    p.push(txt(cx, by + 180, 'Etkinlik', { size: 22, weight: 'bold' }));
    p.push(txt(cx, by + 208, 'yok', { size: 22, weight: 'bold' }));
  } else {
    // En fazla 3 etkinlik: saat 26px + başlık 2 satıra kadar 16px.
    const shown = evs.slice(0, 3);
    const extra = evs.length - shown.length;
    shown.forEach((e, i) => {
      const y = by + 118 + i * 80;
      p.push(txt(cx, y, e.time, { size: e.time.length > 5 ? 22 : 26, weight: 'bold' }));
      wrapTitle(displayTitle(e.title), 13).forEach((l, j) => {
        p.push(txt(cx, y + 21 + j * 19, l, { size: fitSerif(l, bw - 10, 16), weight: 'bold' }));
      });
    });
    if (extra > 0) p.push(txt(cx, by + bh - 10, `+${extra} daha`, { size: 15, style: 'italic', weight: 'bold' }));
  }
  return p.join('');
}

// --- Sağ kutu: Hava durumu ---
// Uzaktan okunurluk: gündüz sıcaklığı dev Bebas rakam, diğerleri ≥18px kalın.
function weatherBox(model) {
  const bx = WX_X, by = BOX_Y, bw = BOX_W, bh = BOX_H, cx = bx + bw / 2;
  const w = model.weather;
  const p = [rect(bx, by, bw, bh, 2.5)];
  const labels = WEATHER_LABEL.slice(0, 2);
  labels.forEach((l, i) => {
    p.push(txt(cx, by + 26 + i * 22, l, { size: fitSerif(l, bw - 14, 20), weight: 'bold' }));
  });
  p.push(line(bx + 10, by + 60, bx + bw - 10, by + 60, 1.6));

  p.push(weatherIcon(w.ikon, cx, by + 96));

  const dl = wrapDurum(w.durum);
  if (dl.length === 1) {
    p.push(txt(cx, by + 150, dl[0], { size: fitSerif(dl[0], bw - 12, 20), weight: 'bold' }));
  } else {
    p.push(txt(cx, by + 142, dl[0], { size: fitSerif(dl[0], bw - 12, 17), weight: 'bold' }));
    p.push(txt(cx, by + 161, dl[1], { size: fitSerif(dl[1], bw - 12, 17), weight: 'bold' }));
  }

  // Gündüz sıcaklığı: dev rakam (uzaktan bir bakışta)
  const gunduz = w.gunduz == null ? '—' : `${w.gunduz}°`;
  p.push(txt(cx, by + 238, gunduz, { family: DISPLAY, size: fitSize(gunduz, bw - 12, 76) }));
  const geceS = `Gece ${w.gece == null ? '—' : `${w.gece}°`}`;
  p.push(txt(cx, by + 266, geceS, { size: fitSerif(geceS, bw - 12, 20), weight: 'bold' }));
  p.push(line(bx + 12, by + 282, bx + bw - 12, by + 282, 1.3));

  const nem = w.nem == null ? '—' : `%${w.nem}`;
  p.push(txt(cx, by + 308, `Nem ${nem}`, { size: 18, weight: 'bold' }));
  const ruz = w.ruzgar == null ? 'Rüzgar —' : `Rüzgar ${w.ruzgar}`;
  p.push(txt(cx, by + 334, ruz, { size: fitSerif(ruz, bw - 12, 18), weight: 'bold' }));
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
  s.push(txt(W / 2, 600, dd, { family: DISPLAY, size: 350 }));

  // --- Gün adı (uzun adlar için font boyutu küçülür, glif bozulmaz) ---
  // Ç/Ş çengelleri baseline'ın ~0.2em altına iner; çizgiyle çakışmasın diye
  // baseline 700, bölücü 730.
  s.push(txt(W / 2, 700, model.weekdayName,
    { family: DISPLAY, size: fitSize(model.weekdayName, 290, 86) }));

  s.push(line(30, 730, 570, 730, 4));

  // --- Günün sözü --- (kısa: tek satır; uzun: ortadan dengeli 2 satır)
  // Alt bandın (bölücü 730 — iç çerçeve 780) dikey ortasına hizalanır.
  // Mürekkep merkezi ≈ baseline - 0.245*size (cap ~0.7, descender ~0.21).
  const q = model.quote || '';
  const zoneMid = 751; // alt bant ortası, sağ alttaki form no ile çakışmasın diye hafif yukarı
  const oneLine = fitSerif(q, 480, 26);
  if (oneLine >= 19) {
    const size = oneLine;
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
    const size = Math.min(19, fitSerif(l1, 520, 19), fitSerif(l2, 450, 19));
    const gap = 22;
    const y1 = Math.round(zoneMid - gap / 2 + 0.245 * size); // iki satırın mürekkep merkezi zoneMid
    s.push(txt(W / 2, y1, l1, { size, weight: 'bold' }));
    if (l2) s.push(txt(W / 2, y1 + gap, l2, { size, weight: 'bold' }));
  }

  // Form no (iç çerçevenin içinde kalır)
  s.push(txt(566, 775, FOOTER_TEXT, { size: 14, weight: 'bold', anchor: 'end' }));

  s.push('</svg>');
  return s.join('\n');
}

// --- 800x600 yatay maarif yaprağı ---------------------------------------
// Kindle /image-landscape/auto.png ile bunu çeker (cihazda 90° döndürülür).
// Tek sayfada: Miladi/Rumi/Hicri tarih, saat, büyük gün, ajanda, hava,
// gün doğumu/batımı, tarihte bugün + özel gün, günün menüsü, isimler, özlü söz.
export const LANDSCAPE_VARIANTS = Object.freeze(['balanced', 'date-focus', 'agenda-focus']);

export function selectLandscapeVariant(model) {
  return (model.events || []).length > 0 ? 'agenda-focus' : 'date-focus';
}

// Kelime sınırından en fazla maxLines satıra sar; taşarsa son satır "…".
function wrapWords(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) { cur = ''; break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const used = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    lines[lines.length - 1] = clip(lines[lines.length - 1], maxChars - 1).replace(/[\s,.;:—-]*…?$/, '') + '…';
  }
  return lines;
}

function landscapeHeader(model) {
  const p = [];
  const miladi = `Miladi ${model.effective.year} · Ay ${model.effective.month} · Gün ${model.dayOfYear}`;
  const rumi = model.rumi ? `Rumi ${model.rumi.gun} ${model.rumi.ayAdi} ${model.rumi.yil}` : '';
  const hicri = `Hicri ${model.hicri.gun} ${model.hicri.ayAdi} ${model.hicri.yil}`;
  const hizir = `${model.hizir.tur} ${model.hizir.gun}`;
  p.push(txt(165, 66, miladi, { size: fitSerif(miladi, 280, 19), weight: 'bold' }));
  if (rumi) p.push(txt(165, 92, rumi, { size: fitSerif(rumi, 280, 17), weight: 'bold' }));
  p.push(clock(400, 75, 34, model.now.hour, model.now.minute));
  p.push(txt(635, 66, hicri, { size: fitSerif(hicri, 280, 19), weight: 'bold' }));
  p.push(txt(635, 92, hizir, { size: 17, weight: 'bold' }));
  p.push(line(26, 112, 774, 112, 3));
  return p.join('');
}

// Dikey tarih kutusu (ajandalı düzen): ay / dev gün / gün adı.
function landscapeDateColumn(model, x, y, w, h) {
  const p = [rect(x, y, w, h, 3)];
  const cx = x + w / 2;
  p.push(txt(cx, y + 40, model.monthName, { family: DISPLAY, size: fitSize(model.monthName, w - 30, 42), spacing: 2 }));
  p.push(line(x + 14, y + 52, x + w - 14, y + 52, 1.5));
  const day = String(model.effective.day).padStart(2, '0');
  p.push(txt(cx, y + h - 40, day, { family: DISPLAY, size: Math.min(150, Math.floor((h - 100) / 0.72)) }));
  p.push(txt(cx, y + h - 9, model.weekdayName, { family: DISPLAY, size: fitSize(model.weekdayName, w - 30, 34), spacing: 1 }));
  return p.join('');
}

// Yatay tarih kutusu (ajandasız düzen): dev gün solda, ay + gün adı sağda.
function landscapeDateWide(model, x, y, w, h) {
  const p = [rect(x, y, w, h, 3)];
  const day = String(model.effective.day).padStart(2, '0');
  const leftW = Math.round(w * 0.46);
  p.push(txt(x + leftW / 2 + 4, y + h - 22, day, {
    family: DISPLAY, size: Math.min(Math.floor((h - 36) / 0.72), Math.floor((leftW - 10) / 0.86)),
  }));
  p.push(line(x + leftW + 6, y + 16, x + leftW + 6, y + h - 16, 1.5));
  const rx = x + leftW + 6 + (w - leftW - 6) / 2;
  const rw = w - leftW - 34;
  p.push(txt(rx, y + 84, model.monthName, { family: DISPLAY, size: fitSize(model.monthName, rw, 72), spacing: 2 }));
  p.push(txt(rx, y + 160, model.weekdayName, { family: DISPLAY, size: fitSize(model.weekdayName, rw, 58), spacing: 1 }));
  return p.join('');
}

function landscapeAgenda(model, x, y, w, h) {
  const p = [rect(x, y, w, h, 2.5)];
  const label = model.rolled ? 'YARININ AJANDASI' : 'BUGÜNÜN AJANDASI';
  p.push(txt(x + w / 2, y + 26, label, { size: fitSerif(label, w - 30, 18), weight: 'bold', spacing: 0.4 }));
  p.push(line(x + 12, y + 38, x + w - 12, y + 38, 1.5));

  const all = model.events || [];
  const events = all.slice(0, 3);
  const extra = all.length - events.length;
  const rowH = (h - 44 - (extra > 0 ? 18 : 0)) / Math.max(events.length, 1);
  const titleX = x + 84;
  const titleW = w - 94;
  events.forEach((event, i) => {
    const top = y + 42 + i * rowH;
    const lines = wrapWords(displayTitle(event.title), Math.floor(titleW / 9.6), rowH >= 52 ? 2 : 1);
    const blockH = 18 + (lines.length - 1) * 20;
    const base = top + (rowH - blockH) / 2 + 15;
    p.push(`<g aria-label="${esc(`${event.time} ${event.title}`)}">`);
    p.push(txt(x + 12, base + 2, event.time, {
      size: event.time.length > 5 ? Math.min(15, fitSerif(event.time, 66, 15)) : 22, weight: 'bold', anchor: 'start',
    }));
    lines.forEach((l, j) => {
      p.push(txt(titleX, base + j * 20, l, { size: fitSerif(l, titleW, 18), anchor: 'start', weight: 'bold' }));
    });
    if (i < events.length - 1) p.push(line(x + 12, top + rowH, x + w - 12, top + rowH, 0.8));
    p.push('</g>');
  });
  if (extra > 0) p.push(txt(x + w / 2, y + h - 7, `+${extra} etkinlik daha`, { size: 14, weight: 'bold', style: 'italic' }));
  return p.join('');
}

function landscapeWeather(model, x, y, w, h) {
  const weather = model.weather;
  const p = [rect(x, y, w, h, 2.5)];
  const cx = x + w / 2;
  const label = WEATHER_LABEL.join(' · ');
  p.push(txt(cx, y + 26, label, { size: fitSerif(label, w - 20, 17), weight: 'bold', spacing: 0.4 }));
  p.push(line(x + 12, y + 38, x + w - 12, y + 38, 1.5));
  p.push(weatherIcon(weather.ikon, x + 42, y + 70));
  const dl = wrapDurum(weather.durum);
  dl.forEach((l, i) => p.push(txt(x + 80, y + (dl.length === 1 ? 78 : 68 + i * 19), l, {
    size: fitSerif(l, w - 90, dl.length === 1 ? 20 : 17), anchor: 'start', weight: 'bold',
  })));
  const day = weather.gunduz == null ? '—' : `${weather.gunduz}°`;
  const night = weather.gece == null ? '—' : `${weather.gece}°`;
  p.push(txt(cx, y + 160, day, { family: DISPLAY, size: fitSize(day, w - 30, 70) }));
  p.push(txt(cx, y + 185, `Gece ${night}`, { size: 19, weight: 'bold' }));
  const humidity = weather.nem == null ? '—' : `%${weather.nem}`;
  const wind = weather.ruzgar == null ? '—' : `${weather.ruzgar} km/s`;
  const extra = `Nem ${humidity} · ${wind}`;
  p.push(txt(cx, y + h - 10, extra, { size: fitSerif(extra, w - 18, 15), weight: 'bold' }));
  return p.join('');
}

function landscapeSolarStrip(model, x, y, w, h) {
  const weather = model.weather || {};
  const cells = [
    ['Gün doğumu', weather.gunDogumu || '—'],
    ['Gün batımı', weather.gunBatimi || '—'],
    ['Gündüz', weather.gunduzSuresi || '—'],
    ['İsim', [model.names?.girl, model.names?.boy].filter(Boolean).join(' · ') || '—'],
  ];
  const p = ['<g data-section="solar">', rect(x, y, w, h, 2)];
  const cellW = w / cells.length;
  cells.forEach(([label, value], i) => {
    const cx = x + cellW * (i + 0.5);
    if (i > 0) p.push(line(x + cellW * i, y + 7, x + cellW * i, y + h - 7, 1));
    p.push(txt(cx, y + 17, label, { size: 13, weight: 'bold', spacing: 0.4 }));
    p.push(txt(cx, y + h - 8, value, { size: fitSerif(value, cellW - 14, 20), weight: 'bold' }));
  });
  p.push('</g>');
  return p.join('');
}

function landscapeHistory(model, x, y, w, h) {
  const p = ['<g data-section="history">', rect(x, y, w, h, 2)];
  p.push(txt(x + w / 2, y + 19, 'TARİHTE BUGÜN', { size: 14, weight: 'bold', spacing: 1 }));
  p.push(line(x + 12, y + 27, x + w - 12, y + 27, 1));
  const { event, special } = model.history || {};
  let ty = y + 47;
  if (special) {
    p.push(txt(x + w / 2, ty, special, { size: fitSerif(special, w - 24, 17), weight: 'bold', style: 'italic' }));
    ty += 22;
  }
  if (event) {
    const lh = 19;
    const maxLines = Math.max(1, Math.floor((y + h - 6 - ty) / lh) + 1);
    const lines = wrapWords(`${event.year} — ${event.text}`, Math.floor((w - 24) / 7.9), maxLines);
    lines.forEach((l, i) => p.push(txt(x + 14, ty + i * lh, l, {
      size: fitSerif(l, w - 24, 15.5), anchor: 'start', weight: i === 0 ? 'bold' : 'normal',
    })));
  } else if (!special) {
    p.push(txt(x + w / 2, y + h / 2 + 12, '—', { size: 18 }));
  }
  p.push('</g>');
  return p.join('');
}

function landscapeMenu(model, x, y, w, h) {
  const p = ['<g data-section="menu">', rect(x, y, w, h, 2)];
  p.push(txt(x + w / 2, y + 21, 'GÜNÜN MENÜSÜ', { size: 15, weight: 'bold', spacing: 1 }));
  p.push(line(x + 12, y + 30, x + w - 12, y + 30, 1));
  const m = model.menu || {};
  const items = [m.corba, m.ana, m.yaninda, m.tatli].filter(Boolean);
  const step = (h - 40) / Math.max(items.length, 1);
  items.forEach((item, i) => {
    p.push(txt(x + w / 2, y + 30 + step * (i + 0.5) + 6, item, { size: fitSerif(item, w - 20, 17), weight: i === 1 ? 'bold' : 'normal' }));
  });
  p.push('</g>');
  return p.join('');
}

function landscapeQuote(model) {
  const quote = String(model.quote || '');
  const source = model.quoteSource ? `— ${model.quoteSource}` : '';
  const p = ['<g data-section="quote">', line(26, 528, 774, 528, 3)];
  const one = fitSerif(quote, 690, 23);
  if (one >= 18) {
    p.push(txt(400, 556, quote, { size: one, weight: 'bold', style: 'italic' }));
  } else {
    const [l1, l2 = ''] = wrapWords(quote, Math.ceil(quote.length / 2) + 6, 2);
    const size = Math.min(19, fitSerif(l1, 700, 19), fitSerif(l2, 600, 19));
    p.push(txt(400, 549, l1, { size, weight: 'bold', style: 'italic' }));
    p.push(txt(400, 571, l2, { size, weight: 'bold', style: 'italic' }));
  }
  if (source) p.push(txt(770, 579, source, { size: 13, weight: 'bold', anchor: 'end' }));
  p.push(txt(30, 579, FOOTER_TEXT, { size: 11, weight: 'bold', anchor: 'start' }));
  p.push('</g>');
  return p.join('');
}

export function buildLandscapeSVG(model, variant = 'balanced') {
  if (!LANDSCAPE_VARIANTS.includes(variant)) throw new Error(`Unknown landscape layout: ${variant}`);

  const s = [`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-layout="${variant}">`];
  s.push('<rect x="0" y="0" width="800" height="600" fill="#ffffff"/>');
  s.push(txt(400, 24, HEADER_TEXT, { size: fitSerif(HEADER_TEXT, 700, 19), weight: 'bold', spacing: 2 }));
  s.push(rect(12, 33, 776, 555, 3.5));
  s.push(rect(18, 39, 764, 543, 1.2));
  s.push(landscapeHeader(model));

  const top = 120, mainH = 214;
  if (variant === 'date-focus') {
    s.push(landscapeDateWide(model, 30, top, 524, mainH));
  } else {
    s.push(landscapeDateColumn(model, 30, top, 248, mainH));
    s.push(landscapeAgenda(model, 288, top, 266, mainH));
  }
  s.push(landscapeWeather(model, 564, top, 206, mainH));
  s.push(landscapeSolarStrip(model, 30, 342, 740, 46));
  s.push(landscapeHistory(model, 30, 396, 474, 126));
  s.push(landscapeMenu(model, 514, 396, 256, 126));
  s.push(landscapeQuote(model));
  s.push('</svg>');
  return s.join('\n');
}
