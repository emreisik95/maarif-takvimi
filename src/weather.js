// Muğla / Menteşe / Ortaköy hava durumu — Open-Meteo (API anahtarı gerekmez).
// Gündüz (max) ve gece (min) sıcaklığı, nem, rüzgar, WMO durum kodu.

import { num } from './env.js';

const LAT = num(process.env.WEATHER_LAT, 37.2153);   // Menteşe / Ortaköy civarı
const LON = num(process.env.WEATHER_LON, 28.3636);
const CACHE_TTL_MS = num(process.env.WEATHER_TTL_MS, 30 * 60 * 1000); // 30 dk
const RETRY_MS = 60 * 1000;        // hata sonrası tekrar denemeler arası min süre
const COLD_RETRY_MS = 15 * 1000;   // hiç veri yokken daha hızlı dene

let cache = { goodAt: 0, triedAt: 0, data: null };

// WMO hava kodu -> {durum metni, ikon tipi}
export function wmoToInfo(code) {
  const m = {
    0: ['Açık', 'sun'],
    1: ['Az Bulutlu', 'partly'],
    2: ['Parçalı Bulutlu', 'partly'],
    3: ['Kapalı', 'cloud'],
    45: ['Sisli', 'fog'], 48: ['Sisli', 'fog'],
    51: ['Çisenti', 'rain'], 53: ['Çisenti', 'rain'], 55: ['Çisenti', 'rain'],
    56: ['Dondurucu Çisenti', 'rain'], 57: ['Dondurucu Çisenti', 'rain'],
    61: ['Yağmurlu', 'rain'], 63: ['Yağmurlu', 'rain'], 65: ['Kuvvetli Yağmur', 'rain'],
    66: ['Dondurucu Yağmur', 'rain'], 67: ['Dondurucu Yağmur', 'rain'],
    71: ['Karlı', 'snow'], 73: ['Karlı', 'snow'], 75: ['Yoğun Kar', 'snow'],
    77: ['Kar Taneli', 'snow'],
    80: ['Sağanak', 'rain'], 81: ['Sağanak', 'rain'], 82: ['Kuvvetli Sağanak', 'rain'],
    85: ['Kar Sağanağı', 'snow'], 86: ['Kar Sağanağı', 'snow'],
    95: ['Gök Gürültülü', 'storm'],
    96: ['Dolu Fırtına', 'storm'], 99: ['Dolu Fırtına', 'storm'],
  };
  return m[code] ?? ['—', 'cloud'];
}

async function fetchOnce() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', LAT);
  url.searchParams.set('longitude', LON);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max');
  url.searchParams.set('hourly', 'relative_humidity_2m');
  url.searchParams.set('timezone', 'Europe/Istanbul');
  url.searchParams.set('forecast_days', '3');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Soğuk başlangıçta tek seferlik ağ hatasını yut: 1 kez tekrar dene.
async function fetchForecast() {
  try {
    return await fetchOnce();
  } catch (err) {
    console.error('[weather] ilk deneme başarısız, tekrar:', err.message);
    return await fetchOnce();
  }
}

const EMPTY = { ok: false, gunduz: null, gece: null, nem: null, ruzgar: null, durum: '—', ikon: 'cloud' };

// effectiveISO: "YYYY-MM-DD" — o güne ait değerleri döndürür.
export async function getWeather(effectiveISO) {
  const now = Date.now();
  const fresh = cache.data && now - cache.goodAt <= CACHE_TTL_MS;
  const minGap = cache.data ? RETRY_MS : COLD_RETRY_MS;
  // Bayat veya hiç veri yoksa ve son denemenin üstünden yeterince geçtiyse dene.
  if (!fresh && now - cache.triedAt >= minGap) {
    cache.triedAt = now;
    try {
      cache.data = await fetchForecast();
      cache.goodAt = now;
    } catch (err) {
      console.error('[weather] fetch başarısız:', err.message);
      // eski cache (varsa) korunur; yoksa null kalır — hammerleme yok.
    }
  }
  const raw = cache.data;
  if (!raw?.daily?.time) return EMPTY;

  const idx = raw.daily.time.indexOf(effectiveISO);
  if (idx < 0) return EMPTY; // bayat veri istenen günü kapsamıyor: yanlış gün yerine "—"
  const i = idx;

  const code = raw.daily.weather_code?.[i];
  const [durum, ikon] = wmoToInfo(code);

  // Nem: o güne ait saatlik ortalamanın yuvarlanmışı
  let nem = null;
  if (raw.hourly?.time && raw.hourly?.relative_humidity_2m) {
    const vals = [];
    for (let k = 0; k < raw.hourly.time.length; k++) {
      if (raw.hourly.time[k].startsWith(effectiveISO)) {
        const v = raw.hourly.relative_humidity_2m[k];
        if (typeof v === 'number') vals.push(v);
      }
    }
    if (vals.length) nem = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  return {
    ok: true,
    gunduz: round(raw.daily.temperature_2m_max?.[i]),
    gece: round(raw.daily.temperature_2m_min?.[i]),
    nem,
    ruzgar: round(raw.daily.wind_speed_10m_max?.[i]),
    durum,
    ikon,
  };
}

function round(v) {
  return typeof v === 'number' ? Math.round(v) : null;
}
