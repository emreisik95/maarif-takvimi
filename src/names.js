// Her takvim günü için çevrimdışı, sabit kız/erkek ismi önerileri.
// Ay ve gün bazlı seçim sayesinde aynı tarih farklı yıllarda aynı isimleri gösterir.
const GIRL_NAMES = Object.freeze([
  'Ada', 'Alya', 'Asel', 'Asya', 'Ayça', 'Aylin', 'Azra', 'Bade',
  'Beril', 'Ceren', 'Ceyda', 'Damla', 'Defne', 'Deren', 'Duru', 'Ece',
  'Ecrin', 'Ela', 'Elif', 'Elvan', 'Esila', 'Eylül', 'Gökçe', 'Hazal',
  'Hilal', 'İdil', 'İlayda', 'İnci', 'İpek', 'Irmak', 'Lale', 'Lina',
  'Masal', 'Melek', 'Melis', 'Mina', 'Miray', 'Nehir', 'Nisan', 'Öykü',
  'Pelin', 'Rüya', 'Selin', 'Serra', 'Sude', 'Şimal', 'Tuana', 'Yağmur',
  'Yaren', 'Yasemin', 'Zehra', 'Zeynep',
]);

const BOY_NAMES = Object.freeze([
  'Alp', 'Alparslan', 'Aras', 'Arda', 'Atlas', 'Ayaz', 'Baran', 'Bartu',
  'Batuhan', 'Berk', 'Bora', 'Buğra', 'Can', 'Çağan', 'Çınar', 'Demir',
  'Deniz', 'Doruk', 'Efe', 'Emir', 'Emre', 'Eren', 'Evren', 'Göktuğ',
  'Kaan', 'Kerem', 'Kıvanç', 'Koray', 'Kuzey', 'Mert', 'Mete', 'Miran',
  'Oğuz', 'Onur', 'Ömer', 'Poyraz', 'Rüzgar', 'Sarp', 'Selim', 'Taha',
  'Tan', 'Taylan', 'Toprak', 'Tuna', 'Umut', 'Uras', 'Utku', 'Yaman',
  'Yiğit', 'Yunus', 'Zafer', 'Eymen',
]);

function calendarDayIndex(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!match) throw new Error('Date must use YYYY-MM-DD format');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (
    original.getUTCFullYear() !== year ||
    original.getUTCMonth() !== month - 1 ||
    original.getUTCDate() !== day
  ) {
    throw new Error('Date must be a valid YYYY-MM-DD value');
  }

  const leapYearStart = Date.UTC(2000, 0, 1);
  return Math.floor((Date.UTC(2000, month - 1, day) - leapYearStart) / 86400000);
}

export function getNameSuggestions(effectiveISO) {
  const day = calendarDayIndex(effectiveISO);
  return {
    girl: GIRL_NAMES[day % GIRL_NAMES.length],
    boy: BOY_NAMES[(day * 5 + 11) % BOY_NAMES.length],
  };
}
