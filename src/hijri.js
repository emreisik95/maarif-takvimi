// Hicri tarih (Um al-Qura, ICU üzerinden) + Rûz-ı Hızır / Rûz-ı Kasım sayacı.

export const HICRI_AYLAR = [
  'Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir',
  'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Şaban',
  'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce',
];

// Gregoryen sivil tarih -> Hicri {gun, ay, ayAdi, yil}
export function getHicri({ year, month, day }) {
  // Gün ortası (12:00 UTC) alarak sınır kaymalarından kaçın.
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(instant)) p[type] = value;
  const ay = Number(p.month);
  return {
    gun: Number(p.day),
    ay,
    ayAdi: HICRI_AYLAR[ay - 1] ?? '',
    yil: Number(p.year),
  };
}

// Rûz-ı Hızır: 6 Mayıs (=Hızır 1) ... 7 Kasım (=Hızır 186)
// Rûz-ı Kasım: 8 Kasım (=Kasım 1) ... 5 Mayıs (=Kasım 179)
export function getHizirKasim({ year, month, day }) {
  const cur = Date.UTC(year, month - 1, day);
  const may6 = Date.UTC(year, 4, 6);   // Mayıs = index 4
  const nov8 = Date.UTC(year, 10, 8);  // Kasım = index 10
  const DAY = 86400000;

  if (cur >= may6 && cur < nov8) {
    return { tur: 'Hızır', gun: Math.floor((cur - may6) / DAY) + 1 };
  }
  const baslangicYili = cur >= nov8 ? year : year - 1;
  const baslangic = Date.UTC(baslangicYili, 10, 8);
  return { tur: 'Kasım', gun: Math.floor((cur - baslangic) / DAY) + 1 };
}

// Rumi (Mali) takvim: Jülyen takvimi, yıl 1 Mart'ta başlar, yıl = Jülyen - 584.
export const RUMI_AYLAR = [
  'Kânunusani', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Teşrinievvel', 'Teşrinisani', 'Kânunuevvel',
];

// Gregoryen -> Jülyen (JDN üzerinden) -> Rumi {gun, ay, ayAdi, yil}
export function getRumi({ year, month, day }) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  // JDN -> Jülyen takvimi
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  const jDay = e - Math.floor((153 * mm + 2) / 5) + 1;
  const jMonth = mm + 3 - 12 * Math.floor(mm / 10);
  const jYear = d - 4800 + Math.floor(mm / 10);
  return {
    gun: jDay,
    ay: jMonth,
    ayAdi: RUMI_AYLAR[jMonth - 1],
    yil: jMonth >= 3 ? jYear - 584 : jYear - 585,
  };
}
