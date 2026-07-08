// SVG -> PNG (resvg). Fontlar diskten bir kez yüklenir; tarayıcı/CSS bağımlılığı yok.
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS = join(__dirname, '..', 'fonts');

const FONT_FILES = [
  join(FONTS, 'BebasNeue-Regular.ttf'),
  join(FONTS, 'PTSerif-Regular.ttf'),
  join(FONTS, 'PTSerif-Bold.ttf'),
  join(FONTS, 'PTSerif-BoldItalic.ttf'),
];

const OUT_WIDTH = Number(process.env.OUT_WIDTH ?? 600); // Kindle Touch = 600

export function svgToPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OUT_WIDTH },
    background: 'white',
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'PT Serif',
    },
    shapeRendering: 2,   // crispEdges kapalı, kaliteli
    textRendering: 2,
  });
  return resvg.render().asPng();
}
