// Makes one small page per built-in dish in share/, so a shared link shows that dish's
// name and picture in WhatsApp and other apps. Run after changing recipes: node make-share-pages.js
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/recipes.js", "utf8").replace(/^const /gm, "var ");
const ctx = {}; new Function("ctx", src + "\nctx.RECIPES=RECIPES;ctx.STOCK=typeof STOCK!=='undefined'?STOCK:{};ctx.BASE=BASE;")(ctx);
const APP = "https://chriskal-a11y.github.io/Recipe-Book/";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtMin = m => m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
fs.mkdirSync(__dirname + "/share", { recursive: true });
for (const r of ctx.RECIPES) {
  const v = r.versions.intermediate, min = v.steps.filter(s => !s[2]).reduce((a, s) => a + s[1], 0);
  const img = (ctx.STOCK[r.id] && ctx.STOCK[r.id].src) || APP + "icons/icon-512.png";
  const desc = `${r.nameGr} · ${fmtMin(min)} · ${r.category}. Basic, intermediate and advanced versions.`;
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.name)} · My Recipe Book</title>
<meta property="og:type" content="article"><meta property="og:site_name" content="My Recipe Book">
<meta property="og:title" content="${esc(r.name)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${APP}share/${r.id}.html">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../#${r.id}"><link rel="icon" href="../icons/icon-192.png">
</head><body style="font-family:sans-serif;padding:24px"><p>Opening <a href="../#${r.id}">${esc(r.name)}</a>…</p></body></html>
`;
  fs.writeFileSync(`${__dirname}/share/${r.id}.html`, page);
}
console.log("made", ctx.RECIPES.length, "share pages");
