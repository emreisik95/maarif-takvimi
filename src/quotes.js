// Günün sözü — tarihe göre deterministik "rastgele" seçim.
// data/replikler.json varsa onu, yoksa data/quotes.json'u (atasözleri) kullanır.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');

function load() {
  // QUOTES_FILE env'i ile özel dosya verilebilir (JSON string dizisi).
  const custom = process.env.QUOTES_FILE;
  if (custom && existsSync(custom)) return JSON.parse(readFileSync(custom, 'utf8'));
  const replik = join(DATA, 'replikler.json');
  const file = existsSync(replik) ? replik : join(DATA, 'quotes.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}
const quotes = load();

// FNV-1a — aynı gün hep aynı söz, günler arası sıra tahmin edilemez (rastgele hissi).
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// dateISO: "YYYY-MM-DD"
export function getQuoteOfDay(dateISO) {
  if (!quotes.length) return '';
  return quotes[fnv1a(String(dateISO)) % quotes.length];
}
