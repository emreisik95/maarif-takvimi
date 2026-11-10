// Tüm veri kaynaklarını tek modelde topla (render için).
import { computeDateContext } from './datetime.js';
import { getHicri, getHizirKasim, getRumi } from './hijri.js';
import { getQuoteOfDay } from './quotes.js';
import { getNameSuggestions } from './names.js';
import { getWeather } from './weather.js';
import { getCalendar } from './calendar.js';
import { getOnThisDay } from './onthisday.js';
import { getMenu } from './menu.js';

const NO_HISTORY = { event: null, special: null };

export async function assembleModel(instantMs = Date.now()) {
  const ctx = computeDateContext(instantMs);

  const [weather, calendar, history] = await Promise.all([
    getWeather(ctx.effectiveISO),             // hava: bugün
    getCalendar(ctx.calendarISO, instantMs),  // takvim: 19:00 sonrası yarın; bitenler gizli
    getOnThisDay(ctx.effective).catch(() => NO_HISTORY),
  ]);
  const quote = getQuoteOfDay(ctx.effectiveISO);

  return {
    ...ctx,
    hicri: getHicri(ctx.effective),
    rumi: getRumi(ctx.effective),
    hizir: getHizirKasim(ctx.effective),
    quote: quote.text,
    quoteSource: quote.source,
    names: getNameSuggestions(ctx.effectiveISO),
    menu: getMenu(ctx.effective),
    history: history ?? NO_HISTORY,
    weather,
    events: calendar.events,
    calendarSource: calendar.source,
  };
}
