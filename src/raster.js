// SVG -> PNG (resvg). Fontlar diskten bir kez yüklenir; tarayıcı/CSS bağımlılığı yok.
// Çıktı 8-bit GRAYSCALE PNG'dir (renk tipi 0): Kindle'ın eips'i renkli (RGBA)
// PNG'yi satır baytlarını ayrı piksel sanarak yatayda gerer; gri PNG'yi 1:1 basar.
import { Resvg } from '@resvg/resvg-js';
import { deflateSync } from 'node:zlib';
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

// --- Gri PNG kodlayıcı (PNG8, renk tipi 0) — bağımlılıksız ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function grayPng(gray, width, height) {
  // Her satırın önüne filtre baytı (0 = None) koy.
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit derinliği
  ihdr[9] = 0;  // renk tipi 0 = grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function svgToPng(svg, outWidth = OUT_WIDTH) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: outWidth },
    background: 'white',
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'PT Serif',
    },
    shapeRendering: 2,   // crispEdges kapalı, kaliteli
    textRendering: 2,
  });
  const pixmap = resvg.render();
  const { width, height } = pixmap;
  const rgba = pixmap.pixels; // arka plan 'white' ile bileşik RGBA
  const gray = Buffer.alloc(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // Rec.709 luma; içerik zaten siyah-beyaz ağırlıklı.
    gray[i] = (rgba[p] * 0.2126 + rgba[p + 1] * 0.7152 + rgba[p + 2] * 0.0722 + 0.5) | 0;
  }
  return grayPng(gray, width, height);
}
