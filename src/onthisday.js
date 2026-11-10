// Tarihte bugün + günün özel günü — tr.wikipedia "D Ay" sayfasından
// ("Olaylar" ve "Tatiller ve özel günler" bölümleri). Uydurma bilgi riskine
// karşı içerik her zaman kaynaktan gelir; alınamazsa bölüm boş kalır.
import { num } from './env.js';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TTL_MS = num(process.env.HISTORY_TTL_MS, 12 * 3600 * 1000);
const RETRY_MS = 10 * 60 * 1000;
const MAX_LEN = 170;
const UA = 'maarif-takvimi/1.0 (https://github.com/emreisik95/maarif-takvimi)';
// Türkiye ile ilgili olaylar önce gelir.
const TR_HINT = /türk|osmanlı|atatürk|ankara|istanbul|izmir|anadolu|cumhuriyet|tbmm|kurtuluş|muğla|selanik|çanakkale|inönü|sultan|padişah/i;

const cache = new Map(); // "M-D" -> { at, triedAt, data }

// Wiki işaretlemesini düz metne çevir.
export function cleanWiki(s) {
  return String(s)
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSection(wikitext) {
  return String(wikitext).split('\n')
    .filter((l) => /^\*\s*/.test(l))
    .map((l) => cleanWiki(l.replace(/^\*+\s*/, '')))
    .filter(Boolean);
}

// "1938 - Atatürk ..." -> { year: '1938', text: 'Atatürk ...' }
export function parseEvent(line) {
  const m = /^(\d{1,4}(?:\s*\(?MÖ\)?)?)\s*[-–—:]\s*(.+)$/.exec(line);
  return m ? { year: m[1].trim(), text: m[2].trim() } : null;
}

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Kısa, tercihen Türkiye ile ilgili bir olay seç (aynı gün hep aynı).
export function pickEvent(events, seed) {
  const fit = events.filter((e) => e.text.length <= MAX_LEN);
  const pool = fit.filter((e) => TR_HINT.test(e.text));
  const list = pool.length ? pool : fit.length ? fit : events;
  return list.length ? list[hash(seed) % list.length] : null;
}

async function fetchSection(title, index) {
  const url = new URL('https://tr.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'parse', page: title, prop: 'wikitext', section: String(index),
    format: 'json', formatversion: '2', redirects: '1',
  });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    const json = await res.json();
    return json.parse?.wikitext ?? '';
  } finally {
    clearTimeout(t);
  }
}

async function fetchSections(title) {
  const url = new URL('https://tr.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'parse', page: title, prop: 'sections', format: 'json', formatversion: '2', redirects: '1' });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    return (await res.json()).parse?.sections ?? [];
  } finally {
    clearTimeout(t);
  }
}

async function load(month, day) {
  const title = `${day} ${AYLAR[month - 1]}`;
  const sections = await fetchSections(title);
  const find = (re) => sections.find((s) => re.test(s.line))?.index;
  const evIdx = find(/^Olaylar/i);
  const spIdx = find(/özel gün|tatil/i);
  const [evText, spText] = await Promise.all([
    evIdx ? fetchSection(title, evIdx) : '',
    spIdx ? fetchSection(title, spIdx) : '',
  ]);
  const events = parseSection(evText).map(parseEvent).filter(Boolean);
  const specials = parseSection(spText).filter((s) => s.length <= 80);
  return { events, specials };
}

// { event: {year, text} | null, special: string | null }
export async function getOnThisDay({ year, month, day }) {
  const key = `${month}-${day}`;
  const now = Date.now();
  let entry = cache.get(key);
  const fresh = entry?.data && now - entry.at < TTL_MS;
  if (!fresh && !(entry && now - entry.triedAt < RETRY_MS && !entry.data)) {
    try {
      const data = await load(month, day);
      entry = { at: now, triedAt: now, data };
    } catch (err) {
      console.error('[tarihte-bugün]', err.message);
      entry = { at: entry?.at ?? 0, triedAt: now, data: entry?.data ?? null };
    }
    cache.set(key, entry);
  }
  const data = entry?.data;
  if (!data) return { event: null, special: null };
  // Özel gün: önce Türkiye'ye ait olan, yoksa dünya/uluslararası gün; başka
  // ülkelerin ulusal günleri gösterilmez.
  const tidy = (s) => s.replace(/^Türkiye\s*[-–:]\s*/i, '');
  const special = data.specials.find((s) => TR_HINT.test(s))
    ?? data.specials.find((s) => /^(dünya|uluslararası|yılbaşı)/i.test(s));
  return {
    event: pickEvent(data.events, `${year}-${month}-${day}`),
    special: special ? tidy(special) : null,
  };
}
