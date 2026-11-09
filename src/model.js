// Tüm veri kaynaklarını tek modelde topla (render için).
import { computeDateContext } from './datetime.js';
import { getHicri, getHizirKasim } from './hijri.js';
import { getQuoteOfDay } from './quotes.js';
import { getNameSuggestions } from './names.js';
import { getWeather } from './weather.js';
import { getCalendar } from './calendar.js';

export async function assembleModel(instantMs = Date.now()) {
  const ctx = computeDateContext(instantMs);

  const [weather, calendar] = await Promise.all([
    getWeather(ctx.effectiveISO),             // hava: bugün
    getCalendar(ctx.calendarISO, instantMs),  // takvim: 19:00 sonrası yarın; bitenler gizli
  ]);

  return {
    ...ctx,
    hicri: getHicri(ctx.effective),
    hizir: getHizirKasim(ctx.effective),
    quote: getQuoteOfDay(ctx.effectiveISO),
    names: getNameSuggestions(ctx.effectiveISO),
    weather,
    events: calendar.events,
    calendarSource: calendar.source,
  };
}
