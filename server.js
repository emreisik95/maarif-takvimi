// Saatli Maarif Takvimi — e-ink (Kindle) sunucusu.
// GET /            -> tam ekran PNG gömülü HTML (Kindle tarayıcı kiosk)
// GET /image.png   -> render edilmiş PNG (screensaver hack için de kullanılır)
// GET /image.svg   -> hata ayıklama için SVG
// GET /health      -> sağlık kontrolü
import express from 'express';
import { assembleModel } from './src/model.js';
import { buildSVG } from './src/render.js';
import { svgToPng } from './src/raster.js';
import { num } from './src/env.js';

const app = express();
const PORT = num(process.env.PORT, 3000);
const REFRESH = num(process.env.REFRESH_SECONDS, 300); // e-ink dostu: 5 dk (bozuk env'de bile geçerli sayı)

app.get('/health', (_req, res) => res.type('text').send('ok'));

app.get('/image.svg', async (_req, res) => {
  try {
    const model = await assembleModel();
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(buildSVG(model));
  } catch (err) {
    console.error(err);
    res.status(500).type('text').send('render error: ' + err.message);
  }
});

app.get('/image.png', async (_req, res) => {
  try {
    const model = await assembleModel();
    const png = svgToPng(buildSVG(model));
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
  /* Eski Kindle WebKit'i için basit tut: flex yok, sadece blok + max-width.
     Telefonda device-width viewport ile görüntü ekrana sığar (zoom yok). */
  html,body{margin:0;padding:0;background:#fff;text-align:center}
  img{display:block;margin:0 auto;width:100%;max-width:600px;height:auto}
  @media (min-aspect-ratio: 3/4) {
    /* Yatay/geniş ekran: yüksekliğe sığdır */
    img{width:auto;max-width:100%;max-height:100vh}
  }
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
