const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const svg = fs.readFileSync(process.argv[2], "utf8");
const r = new Resvg(svg, { font: { fontFiles: ["fonts/BebasNeue-Regular.ttf","fonts/PTSerif-Regular.ttf","fonts/PTSerif-Bold.ttf","fonts/PTSerif-BoldItalic.ttf"], loadSystemFonts:false, defaultFontFamily:"PT Serif" } });
const img = r.render(); const px = img.pixels; const W = img.width;
let minY = 1e9, maxY = -1;
for (let y = 733; y < 779; y++) for (let x = 60; x < 500; x++) {
  if (px[(y*W+x)*4] < 100) { if (y<minY) minY=y; if (y>maxY) maxY=y; }
}
console.log(process.argv[2].split("/").pop(), "-> mürekkep y:", minY, "-", maxY, "| merkez", ((minY+maxY)/2).toFixed(1), "| bant merkezi 755");
