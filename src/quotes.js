// Günün sözü — özlü sözler ve atasözleri (data/ozlu-sozler.json).
// Her yıl için tarihe bağlı karışık bir sıra kullanılır: aynı gün hep aynı
// sözü gösterir ve liste uzunluğu kadar gün boyunca söz tekrar etmez.
// QUOTES_FILE env'i: kendi dosyan — ["söz", ...] ya da [{"t": "söz", "k": "kaynak"}, ...].
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');

function load() {
  const custom = process.env.QUOTES_FILE;
  const file = custom && existsSync(custom) ? custom : join(DATA, 'ozlu-sozler.json');
  return JSON.parse(readFileSync(file, 'utf8'))
    .map((q) => (typeof q === 'string' ? { t: q, k: '' } : { t: String(q.t ?? ''), k: String(q.k ?? '') }))
    .filter((q) => q.t);
}
const quotes = load();

// Küçük, tohumlanabilir rastgele sayı üreteci (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orderCache = new Map();
function orderFor(year) {
  if (!orderCache.has(year)) {
    const idx = quotes.map((_, i) => i);
    const rand = rng(year * 2654435761);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    orderCache.set(year, idx);
  }
  return orderCache.get(year);
}

// dateISO: "YYYY-MM-DD" -> { text, source }
export function getQuoteOfDay(dateISO) {
  if (!quotes.length) return { text: '', source: '' };
  const [y, m, d] = String(dateISO).split('-').map(Number);
  const dayIndex = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  const q = quotes[orderFor(y)[dayIndex % quotes.length]];
  return { text: q.t, source: q.k };
}
