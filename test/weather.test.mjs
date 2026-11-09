import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as weather from '../src/weather.js';

test('weather day mapping includes sunrise, sunset, and daylight duration', () => {
  assert.equal(typeof weather.weatherForDate, 'function');

  const raw = {
    daily: {
      time: ['2026-07-14'],
      temperature_2m_max: [31.6],
      temperature_2m_min: [19.7],
      weather_code: [0],
      wind_speed_10m_max: [17.4],
      sunrise: ['2026-07-14T05:52'],
      sunset: ['2026-07-14T20:24'],
      daylight_duration: [52320],
    },
    hourly: {
      time: ['2026-07-14T00:00', '2026-07-14T01:00'],
      relative_humidity_2m: [40, 44],
    },
  };

  assert.deepEqual(weather.weatherForDate(raw, '2026-07-14'), {
    ok: true,
    gunduz: 32,
    gece: 20,
    nem: 42,
    ruzgar: 17,
    durum: 'Açık',
    ikon: 'sun',
    gunDogumu: '05:52',
    gunBatimi: '20:24',
    gunduzSuresi: '14 sa 32 dk',
  });
});
