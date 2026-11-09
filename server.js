// Saatli Maarif Takvimi — e-ink (Kindle) sunucusu.
// GET /            -> tam ekran PNG gömülü HTML (Kindle tarayıcı kiosk)
// GET /image.png   -> render edilmiş PNG (screensaver hack için de kullanılır)
// GET /image.svg   -> hata ayıklama için SVG
// GET /health      -> sağlık kontrolü
import express from 'express';
import { assembleModel } from './src/model.js';
import { buildSVG } from './src/render.js';
import { buildLandscapeSVG } from './src/render-landscape.js';
import { svgToPng } from './src/raster.js';
import { num } from './src/env.js';

const app = express();
const PORT = num(process.env.PORT, 3000);
const REFRESH = num(process.env.REFRESH_SECONDS, 10800); // e-ink dostu: 3 saat (bozuk env'de bile geçerli sayı)

// Yön: ?o=yatay|landscape (veya ORIENTATION env). Yatayda ?r=90|270 döndürme
// yönü (LANDSCAPE_ROTATE env, varsayılan 90); ?r=0 = döndürmeden 800x600 önizleme.
function renderFor(model, query) {
  const o = String(query.o ?? process.env.ORIENTATION ?? 'dikey').toLowerCase();
  if (o !== 'yatay' && o !== 'landscape') return { svg: buildSVG(model), width: undefined };
  const r = Number(query.r ?? process.env.LANDSCAPE_ROTATE ?? 90);
  const rotate = [0, 90, 270].includes(r) ? r : 90;
  return { svg: buildLandscapeSVG(model, rotate), width: rotate === 0 ? 800 : undefined };
}

app.get('/health', (_req, res) => res.type('text').send('ok'));

app.get('/image.svg', async (req, res) => {
  try {
    const model = await assembleModel();
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(renderFor(model, req.query).svg);
  } catch (err) {
    console.error(err);
    res.status(500).type('text').send('render error: ' + err.message);
  }
});

app.get('/image.png', async (req, res) => {
  try {
    const model = await assembleModel();
    const { svg, width } = renderFor(model, req.query);
    const png = svgToPng(svg, width);
    res.type('image/png').set('Cache-Control', 'no-store').send(png);
  } catch (err) {
    console.error(err);
    res.status(500).type('text').send('render error: ' + err.message);
  }
});

app.get('/', (_req, res) => {
  const ts = Date.now();
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta http-equiv="refresh" content="${REFRESH}">
<title>Saatli Maarif Takvimi</title>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff}
  img{display:block;width:100vw;height:100vh;object-fit:contain}
</style>
</head>
<body>
  <img src="/image.png?t=${ts}" width="600" height="800" alt="Saatli Maarif Takvimi">
</body>
</html>`;
  res.type('html').set('Cache-Control', 'no-store').send(html);
});

app.listen(PORT, () => {
  console.log(`Saatli Maarif Takvimi -> http://localhost:${PORT}  (yenileme ${REFRESH}s)`);
  // Önbelleği ısıt: büyük ICS'lerde (10+ MB) ilk istek saniyeler sürmesin.
  assembleModel().then(
    (m) => console.log(`[warmup] takvim: ${m.events.length} etkinlik (${m.calendarSource}), hava: ${m.weather.ok ? 'ok' : 'yok'}`),
    (err) => console.error('[warmup] başarısız:', err.message),
  );
});
