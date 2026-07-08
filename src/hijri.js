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
