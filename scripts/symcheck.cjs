const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const svg = fs.readFileSync(process.argv[2], "utf8");
const r = new Resvg(svg, { font: { fontFiles: ["fonts/BebasNeue-Regular.ttf","fonts/PTSerif-Regular.ttf","fonts/PTSerif-Bold.ttf","fonts/PTSerif-BoldItalic.ttf"], loadSystemFonts:false, defaultFontFamily:"PT Serif" } });
const img = r.render(); const px = img.pixels; const W = img.width;
let minX = 1e9, maxX = -1;
for (let y = 215; y < 290; y++) for (let x = 40; x < 560; x++) {
  if (px[(y*W+x)*4] < 100) { if (x<minX) minX=x; if (x>maxX) maxX=x; }
}
console.log("ay bandı mürekkep: sol", minX, "sağ", maxX, "| merkez", ((minX+maxX)/2).toFixed(1), "| kanvas merkezi 300");
