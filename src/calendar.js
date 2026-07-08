// Google Takvim — CALENDAR_ICS_URL verilirse ICS'ten okur, yoksa dummy döner.
// Türkiye yaz saati uygulamadığı için sabit +03:00 ofseti güvenli.
//
// ÖNEMLİ: Bu modül süreç saat diliminin UTC olmasını varsayar (TZ=UTC).
// node-ical + rrule, tekrar tarihlerini "sahte UTC" olarak döndürür; rrule.between'e
// gerçek-an sınırları verip Intl(Europe/Istanbul) ile biçimlendirmek yalnızca
// TZ=UTC'de tutarlıdır. Dockerfile ve npm scriptleri TZ=UTC ayarlar.
import ical from 'node-ical';
import { num } from './env.js';

const ICS_URL = process.env.CALENDAR_ICS_URL || '';
const MAX_EVENTS = num(process.env.CALENDAR_MAX, 5);
const CACHE_TTL_MS = num(process.env.CALENDAR_TTL_MS, 15 * 60 * 1000);
// Yoğun iş takvimleri 10+ MB olabiliyor — indirme payı geniş tutuldu.
const FETCH_TIMEOUT_MS = num(process.env.CALENDAR_FETCH_TIMEOUT_MS, 30000);
const DAY_MS = 86400000;

let cache = { at: 0, data: null };

const DUMMY = [
  { time: '09:00', title: 'Toplantı' },
  { time: '13:00', title: 'Öğle Molası' },
  { time: '17:00', title: 'Spor' },
];

function hhmm(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function cleanTitle(s) {
  return String(s ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Emoji ve piktograflar: PT Serif'te glifi yok, e-ink'te tofu basar.
    .replace(/[\p{Extended_Pictographic}️‍⃣]/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Etkinlik';
}

function isCancelled(x) {
  return String(x?.status ?? x ?? '').toUpperCase() === 'CANCELLED';
}

// Takvim sahibi (reddedilen davetleri gizlemek için). ICS URL'inden türetilir;
// gerekirse CALENDAR_OWNER env'i ile ezilebilir.
const OWNER = (process.env.CALENDAR_OWNER
  ?? decodeURIComponent((ICS_URL.match(/\/ical\/([^/]+)\//) ?? [])[1] ?? '')).toLowerCase();

// Sahibin PARTSTAT'ı DECLINED ise etkinlik reddedilmiştir.
// Dönüş: true/false, attendee bilgisi yoksa null (karar verilemez).
function declinedByOwner(ev) {
  if (!OWNER || !ev?.attendee) return null;
  const atts = Array.isArray(ev.attendee) ? ev.attendee : [ev.attendee];
  const me = atts.find((a) => String(a?.val ?? a).toLowerCase().includes(OWNER));
  if (!me) return null;
  return me?.params?.PARTSTAT === 'DECLINED';
}

// Gürültü etkinlikleri: hatırlatma/blok tarzı, takvim kutusunda yer kaplamasın.
// CALENDAR_HIDE env'i ile virgülle ayrılmış anahtar kelimeler verilebilir.
const HIDE_KEYWORDS = (process.env.CALENDAR_HIDE ?? 'focus time,deadline,check alarms,no meeting')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isNoise(title) {
  const t = String(title).toLowerCase();
  return HIDE_KEYWORDS.some((k) => t.includes(k));
}

// ICS'i zaman aşımıyla çek (node-ical.fromURL'in sonsuz timeout'undan kaçın).
async function loadICS() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let text;
  try {
    const res = await fetch(ICS_URL, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`ICS ${res.status}`);
    text = await res.text();
  } finally {
    clearTimeout(t);
  }
  const data = await ical.async.parseICS(text);
  cache = { at: now, data };
  return data;
}

function eventDurationMs(ev) {
  if (ev.start && ev.end) {
    const d = new Date(ev.end).getTime() - new Date(ev.start).getTime();
    if (d > 0) return d;
  }
  return ev.datetype === 'date' ? DAY_MS : 0;
}

// Tam-an EXDATE eşleşmesi (yalnızca tarih değil — çok/gün kuralında doğru iptal).
function isExcludedInstant(ev, instant) {
  if (!ev.exdate) return false;
  const t = instant.getTime();
  return Object.values(ev.exdate).some((ex) => Math.abs(new Date(ex).getTime() - t) < 60000);
}

function pushEntry(out, startInstant, title, allDay, endInstant) {
  out.push({
    sortKey: allDay ? -1 : startInstant.getTime(),
    time: allDay ? 'Tüm Gün' : hhmm(startInstant),
    title: cleanTitle(title),
    endMs: endInstant ? endInstant.getTime() : startInstant.getTime(),
  });
}

// Bir VEVENT'in [dayStart, dayEnd) penceresine düşen görünümlerini topla.
function collectOccurrences(ev, dayStart, dayEnd, out) {
  const allDay = ev.datetype === 'date';

  if (ev.rrule) {
    // Sahte-UTC kayması için pencereyi ±1 gün genişlet, sonra gerçek sınırla filtrele.
    const from = new Date(dayStart.getTime() - DAY_MS);
    const to = new Date(dayEnd.getTime() + DAY_MS);
    const durMs = eventDurationMs(ev);
    let occ;
    try {
      occ = ev.rrule.between(from, to, true);
    } catch {
      return;
    }
    for (const d of occ) {
      const key = d.toISOString().slice(0, 10);
      let start = d;
      let title = ev.summary;

      // RECURRENCE-ID override: taşınmış/iptal edilmiş tekil tekrar
      const override = ev.recurrences?.[key];
      if (override) {
        if (isCancelled(override)) continue;
        // override'da katılım bilgisi varsa o geçerli, yoksa serininki
        if ((declinedByOwner(override) ?? declinedByOwner(ev)) === true) continue;
        start = new Date(override.start);
        title = override.summary ?? ev.summary;
      } else {
        if (isExcludedInstant(ev, d)) continue;
        if (declinedByOwner(ev) === true) continue;
      }
      if (isCancelled(ev) && !override) continue;

      const end = new Date(start.getTime() + durMs);
      if (allDay) {
        if (start < dayEnd && end > dayStart) pushEntry(out, start, title, true, end);
      } else if (start >= dayStart && start < dayEnd) {
        pushEntry(out, start, title, false, end);
      }
    }
    return;
  }

  // Tek seferlik
  if (!ev.start || isCancelled(ev)) return;
  if (declinedByOwner(ev) === true) return;
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + (allDay ? DAY_MS : 0));
  if (allDay) {
    if (start < dayEnd && end > dayStart) pushEntry(out, start, ev.summary, true, end);
  } else if (start >= dayStart && start < dayEnd) {
    pushEntry(out, start, ev.summary, false, end);
  }
}

// effectiveISO: "YYYY-MM-DD"; nowMs: bitmiş etkinlikleri gizlemek için şu an
export async function getCalendar(effectiveISO, nowMs = Date.now()) {
  if (!ICS_URL) return { events: DUMMY, source: 'dummy' };

  const dayStart = new Date(`${effectiveISO}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  let data;
  try {
    data = await loadICS();
  } catch (err) {
    console.error('[calendar] ICS okunamadı:', err.message);
    if (cache.data) {
      data = cache.data; // bayat da olsa son iyi veriyi göster (uydurma dummy yerine)
    } else {
      return { events: [], source: 'ics-error' };
    }
  }

  const out = [];
  for (const k of Object.keys(data)) {
    const ev = data[k];
    if (!ev || ev.type !== 'VEVENT') continue;
    collectOccurrences(ev, dayStart, dayEnd, out);
  }

  out.sort((a, b) => a.sortKey - b.sortKey);
  // Dedupe: davetli + sahip kopyası gibi aynı saat + aynı başlık tekrarları
  const seenEv = new Set();
  const deduped = out.filter((e) => {
    const k = e.time + '|' + e.title.toLowerCase().replace(/[^a-zçğıöşü0-9]/g, '');
    if (seenEv.has(k)) return false;
    seenEv.add(k);
    return true;
  });
  const visible = deduped
    .filter((e) => e.endMs > nowMs)   // bitmiş etkinlikleri gizle
    .filter((e) => !isNoise(e.title)); // gürültü etkinlikleri gizle
  const events = visible.slice(0, MAX_EVENTS).map((e) => ({ time: e.time, title: e.title }));
  return { events, source: 'ics' };
}
