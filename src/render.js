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

// Bir sonraki (veya süren) etkinlik: önce saatli olanlar, yoksa tüm gün.
function nextEvent(events) {
  const timed = events.filter((e) => /^\d{1,2}:\d{2}$/.test(e.time));
  return timed[0] ?? events[0] ?? null;
}

// Alt kutu her 3 saatlik yenilemede sırayla değişir (günde her biri ~2 kez).
export const ROTATING_PANELS = Object.freeze(['history', 'menu', 'sun', 'calendar']);
export function rotatingPanelFor(model) {
  return ROTATING_PANELS[Math.floor((model.now?.hour ?? 0) / 3) % ROTATING_PANELS.length];
}

function scaledIcon(type, cx, cy, k) {
  return `<g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">${weatherIcon(type, cx, cy)}</g>`;
}

// Sol sütun: AY / dev gün / GÜN ADI
function bigDate(model) {
  const p = [];
  const cx = 162;
  p.push(txt(cx, 76, model.monthName, { family: DISPLAY, size: fitSize(model.monthName, 270, 60), spacing: 3 }));
  const day = String(model.effective.day).padStart(2, '0');
  p.push(txt(cx, 300, day, { family: DISPLAY, size: 262 }));
  p.push(txt(cx, 362, model.weekdayName, { family: DISPLAY, size: fitSize(model.weekdayName, 270, 56), spacing: 1 }));
  return p.join('');
}

function bigWeather(model) {
  const w = model.weather || {};
  const p = [scaledIcon(w.ikon, 362, 84, 1.7)];
  const day = w.gunduz == null ? '—' : `${w.gunduz}°`;
  p.push(txt(500, 142, day, { family: DISPLAY, size: fitSize(day, 160, 124) }));
  const durum = String(w.durum ?? '—');
  p.push(txt(590, 90, durum, { size: fitSerif(durum, 186, 28), weight: 'bold', anchor: 'start' }));
  const gece = `Gece ${w.gece == null ? '—' : `${w.gece}°`}`;
  p.push(txt(590, 132, gece, { size: 28, weight: 'bold', anchor: 'start' }));
  return p.join('');
}

function bigAgenda(model) {
  const p = [];
  const x = 332, w = 436;
  const events = model.events || [];
  const ev = nextEvent(events);
  if (!ev) {
    // Ajanda boşsa: takvim bilgileri büyük.
    const lines = [
      `Hicri ${model.hicri.gun} ${model.hicri.ayAdi}`,
      model.rumi ? `Rumi ${model.rumi.gun} ${model.rumi.ayAdi}` : '',
      `${model.hizir.tur} ${model.hizir.gun} · Gün ${model.dayOfYear}`,
    ].filter(Boolean);
    lines.forEach((l, i) => p.push(txt(x + w / 2, 232 + i * 46, l, { size: fitSerif(l, w, 32), weight: 'bold' })));
    return p.join('');
  }
  const label = model.rolled ? 'YARIN' : 'SIRADAKİ';
  p.push(txt(x, 196, label, { size: 18, weight: 'bold', spacing: 2, anchor: 'start' }));
  const time = ev.time;
  p.push(txt(x, 244, time, { size: time.length > 5 ? 34 : 44, weight: 'bold', anchor: 'start' }));
  wrapWords(displayTitle(ev.title), Math.floor(w / 15.5), 2).forEach((l, i) => {
    p.push(txt(x, 286 + i * 36, l, { size: fitSerif(l, w, 30), weight: 'bold', anchor: 'start' }));
  });
  const others = events.filter((e) => e !== ev);
  if (others.length) {
    const after = others.find((e) => e.time > time && /^\d/.test(e.time)) ?? others[0];
    const more = `sonra ${after.time} ${displayTitle(after.title)}`;
    const tail = others.length > 1 ? `  (+${others.length - 1})` : '';
    p.push(txt(x, 360, clip(more, 34) + tail, { size: fitSerif(clip(more, 34) + tail, w, 22), weight: 'bold', style: 'italic', anchor: 'start' }));
  }
  return p.join('');
}

function rotatingBox(model, y, h) {
  const p = [];
  let panel = rotatingPanelFor(model);
  // Ajanda boşken takvim bilgileri zaten sağda büyük yazılı; tekrar etme.
  if (panel === 'calendar' && !(model.events || []).length) panel = 'sun';
  let title = '';
  let lines = [];
  if (panel === 'history' && (model.history?.event || model.history?.special)) {
    const { event, special } = model.history;
    title = 'TARİHTE BUGÜN';
    if (special) lines.push({ t: special, italic: true });
    if (event) {
      const ev = wrapWords(`${event.year} — ${event.text}`, 52, special ? 1 : 2);
      ev.forEach((t) => lines.push({ t }));
    }
  } else if (panel === 'menu' && model.menu) {
    const m = model.menu;
    title = 'GÜNÜN MENÜSÜ';
    lines = [{ t: `${m.corba} · ${m.ana}` }, { t: `${m.yaninda} · ${m.tatli}` }];
  } else if (panel === 'sun' || panel === 'history' || panel === 'menu') {
    const w = model.weather || {};
    title = 'GÜNEŞ VE İSİMLER';
    lines = [
      { t: `Doğuş ${w.gunDogumu || '—'}   Batış ${w.gunBatimi || '—'}   Gündüz ${w.gunduzSuresi || '—'}` },
      { t: `Bugünün isimleri: ${[model.names?.girl, model.names?.boy].filter(Boolean).join(' · ') || '—'}` },
    ];
  } else {
    title = 'TAKVİM';
    lines = [
      { t: `Hicri ${model.hicri.gun} ${model.hicri.ayAdi} ${model.hicri.yil}` },
      { t: `${model.rumi ? `Rumi ${model.rumi.gun} ${model.rumi.ayAdi} ${model.rumi.yil} · ` : ''}${model.hizir.tur} ${model.hizir.gun}` },
    ];
  }
  p.push(`<g data-section="${panel}">`);
  p.push(txt(400, y + 22, title, { size: 18, weight: 'bold', spacing: 3 }));
  lines.slice(0, 2).forEach((l, i) => {
    p.push(txt(400, y + 60 + i * 36, l.t, {
      size: fitSerif(l.t, 740, 28), weight: 'bold', style: l.italic ? 'italic' : 'normal',
    }));
  });
  p.push('</g>');
  return p.join('');
}

function bigQuote(model, y) {
  const p = ['<g data-section="quote">'];
  const quote = String(model.quote || '');
  const one = fitSerif(quote, 740, 34);
  if (one >= 26) {
    p.push(txt(400, y + 44, quote, { size: one, weight: 'bold', style: 'italic' }));
  } else {
    const [l1, l2 = ''] = wrapWords(quote, Math.ceil(quote.length / 2) + 8, 2);
    const size = Math.min(28, fitSerif(l1, 750, 28), fitSerif(l2, 750, 28));
    p.push(txt(400, y + 32, l1, { size, weight: 'bold', style: 'italic' }));
    p.push(txt(400, y + 66, l2, { size, weight: 'bold', style: 'italic' }));
  }
  if (model.quoteSource) p.push(txt(774, y + 88, `— ${model.quoteSource}`, { size: 16, weight: 'bold', anchor: 'end' }));
  p.push('</g>');
  return p.join('');
}

export function buildLandscapeSVG(model, variant = 'balanced') {
  if (!LANDSCAPE_VARIANTS.includes(variant)) throw new Error(`Unknown landscape layout: ${variant}`);
  const s = [`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-layout="${variant}">`];
  s.push('<rect x="0" y="0" width="800" height="600" fill="#ffffff"/>');
  s.push(rect(8, 8, 784, 584, 4));
  s.push(bigDate(model));
  s.push(line(314, 24, 314, 368, 2));
  s.push(bigWeather(model));
  s.push(line(326, 162, 776, 162, 2));
  s.push(bigAgenda(model));
  s.push(line(24, 378, 776, 378, 3));
  s.push(rotatingBox(model, 380, 110));
  s.push(line(24, 494, 776, 494, 3));
  s.push(bigQuote(model, 496));
  s.push('</svg>');
  return s.join('\n');
}
