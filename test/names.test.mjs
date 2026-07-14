import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNameSuggestions } from '../src/names.js';

test('name suggestions are stable for a calendar date and include a girl and boy name', () => {
  const today = getNameSuggestions('2026-07-14');

  assert.deepEqual(today, getNameSuggestions('2027-07-14'));
  assert.match(today.girl, /^\p{L}[\p{L} .'-]+$/u);
  assert.match(today.boy, /^\p{L}[\p{L} .'-]+$/u);
  assert.notDeepEqual(today, getNameSuggestions('2026-07-15'));
});

test('name suggestions reject malformed dates', () => {
  assert.throws(() => getNameSuggestions('14-07-2026'), /YYYY-MM-DD/);
});
