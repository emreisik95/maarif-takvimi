// Tarih/saat yardımcıları — her şey Europe/Istanbul sivil takvimine göre.
// Akşam 19:00'dan sonra "efektif gün" yarına döner.

import { num } from './env.js';

export const TZ = 'Europe/Istanbul';
// Takvim kutusu dönüşü: bu saatten sonra SOL KUTUDA yarının etkinlikleri
// gösterilir. Tarih/hava her zaman gerçek bugünü gösterir. 24 = kapalı.
export const ROLLOVER_HOUR = Math.min(24, Math.max(0, num(process.env.ROLLOVER_HOUR, 19)));

export const AY_ADLARI = [
  'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
  'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK',
];

// Pazar=0 ... Cumartesi=6 (JS getUTCDay ile uyumlu)
export const GUN_ADLARI = [
  'PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ',
];

// Bir instant'ı verilen TZ'de sivil parçalara ayır.
function zonedParts(instant, tz = TZ) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(instant)) p[type] = value;
  let hour = Number(p.hour);
  if (hour === 24) hour = 0; // bazı ortamlar gece yarısını 24 verir
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

// Sivil tarih {year, month(1-12), day} -> n gün ekle.
function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Sivil tarihin haftanın günü (0=Pazar) ve yılın günü.
function weekdayIndex({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
function dayOfYear({ year, month, day }) {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / 86400000) + 1;
}
function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function iso({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Ana giriş: şu anki instant'tan gerçek saat + günleri hesapla.
// Tarih sayfası ve hava HER ZAMAN gerçek bugünü gösterir; yalnızca takvim
// kutusu ROLLOVER_HOUR sonrası yarına döner.
// instant parametresi test için verilebilir; verilmezse Date.now() kullanılır.
export function computeDateContext(instantMs = Date.now()) {
  const instant = new Date(instantMs);
  const wall = zonedParts(instant); // gerçek İstanbul duvar saati

  const rolled = wall.hour >= ROLLOVER_HOUR;
  const today = { year: wall.year, month: wall.month, day: wall.day };
  const effective = today; // görüntülenen tarih: her zaman bugün
  const calendarDay = rolled ? addDays(today, 1) : today;

  return {
    // gerçek saat (analog saat için)
    now: { hour: wall.hour, minute: wall.minute, second: wall.second },
    rolled,                       // takvim kutusu yarına döndü mü?
    today,                        // gerçek bugün {year,month,day}
    effective,                    // gösterilecek gün (= bugün)
    weekdayIndex: weekdayIndex(effective),
    weekdayName: GUN_ADLARI[weekdayIndex(effective)],
    monthName: AY_ADLARI[effective.month - 1],
    dayOfYear: dayOfYear(effective),
    daysInYear: isLeap(effective.year) ? 366 : 365,
    effectiveISO: iso(effective),   // hava için (bugün)
    calendarISO: iso(calendarDay),  // takvim kutusu için (19:00 sonrası yarın)
  };
}
