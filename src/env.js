// Sayısal ortam değişkenlerini güvenli çöz: boş/garip değerlerde varsayılana düş.
// `??` yalnızca undefined/null'ı yakalar; Number('') === 0 ve Number('abc') === NaN
// sessizce yanlış davranışa yol açardı.
export function num(v, def) {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
