const { chromium } = require('/app/node_modules/playwright');
const fs = require('fs');
const tv = fs.readFileSync('/data/projects/tv-game/js/tv.js', 'utf8');
const ICONS = eval('(' + tv.slice(tv.indexOf('const ICONS = {') + 14, tv.indexOf('};', tv.indexOf('const ICONS = {')) + 1) + ')');
const common = fs.readFileSync('/data/projects/tv-game/js/common.js', 'utf8');
global.window = {}; global.location = { href: '' }; global.navigator = {};
const GAMES = [...common.matchAll(/id: '(\w+)', title: (['"])(.*?)\2, sub: '(.*?)'/g)].map((m) => ({ id: m[1], title: m[3].replace('\\u00AD', ''), sub: m[4] }));
// ανά παιχνίδι: χρώμα, κάδρο (zoom, x%, y%)
const C = {
  cups: ['#ff4d5e', 1.5, 50, 25], star: ['#ffc93d', 1.25, 50, 40, 1], balloon: ['#3da9ff', 1.3, 45, 30], bear: ['#ff9a2e', 1.5, 50, 45],
  tomato: ['#e8302a', 1.5, 25, 40], hoops: ['#f07a1f', 1.45, 50, 45], bubpanda: ['#4fc3ff', 1.35, 50, 40], bubbles: ['#ff5a6e', 1.5, 45, 62],
  space: ['#6ff3ff', 1.4, 60, 55], hunt: ['#8fd14f', 1.3, 50, 35], jungle: ['#4fcf32', 1.45, 30, 70], xeri: ['#ffd76a', 1.12, 50, 40],
  race: ['#ff6b3d', 1.6, 75, 62], trail: ['#9bd35a', 1.4, 50, 60], longjump: ['#3da9ff', 1.6, 62, 62], panda: ['#7cc84a', 1.4, 60, 35],
  sumo: ['#9b5de5', 1.2, 50, 40, 1], who: ['#b98cff', 1.15, 50, 30, 1], ball: ['#ff5a8a', 1.45, 78, 82], chroma: ['#ffc21a', 1.75, 50, 36],
};
(async () => {
  const b = await chromium.launch({ executablePath: '/ms-playwright/chromium-1254/chrome-linux64/chrome' });
  const pg = await b.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  for (const g of GAMES) {
    const [acc, z, x, y, hero] = C[g.id] || ['#ffc93d', 1.3, 50, 40];
    const img = 'data:image/png;base64,' + fs.readFileSync(`/tmp/cov/raw-${g.id}.png`).toString('base64');
    const big = g.title.length > 12;
    await pg.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Noto+Sans:wght@800&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box} body{width:640px;height:360px;overflow:hidden;background:#0d0726;position:relative;font-family:'Noto Sans',sans-serif}
.bg{position:absolute;inset:0;background:url(${img}) ${x}% ${y}%/${z * 100}% auto no-repeat;filter:saturate(1.25) contrast(1.08) brightness(1.02)}
.sh{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%,transparent 45%,rgba(8,3,24,.55) 100%),linear-gradient(180deg,transparent 42%,rgba(10,4,30,.55) 64%,rgba(10,4,30,.94) 100%)}
.glow{position:absolute;left:-60px;bottom:-120px;width:520px;height:260px;background:radial-gradient(closest-side,${acc}66,transparent);filter:blur(10px)}
.ic{position:absolute;left:26px;bottom:28px;width:92px;height:92px;border-radius:22px;background:rgba(255,255,255,.95);padding:10px;box-shadow:0 8px 22px rgba(0,0,0,.5),0 0 0 4px ${acc};transform:rotate(-6deg)}
.ic svg{width:100%;height:100%;display:block}
.t{position:absolute;left:138px;right:20px;bottom:${big ? 52 : 50}px;font:700 ${big ? 38 : 50}px/1 'Comfortaa',sans-serif;color:#fff;letter-spacing:-.01em;
  -webkit-text-stroke:9px #1b0f3a;paint-order:stroke fill;text-shadow:0 5px 0 #1b0f3a,0 10px 24px rgba(0,0,0,.6)}
.s{position:absolute;left:140px;bottom:26px;font-size:15px;letter-spacing:.14em;color:${acc};text-shadow:0 2px 6px #000}
.hero{position:absolute;right:34px;top:26px;width:210px;height:210px;transform:rotate(8deg);filter:drop-shadow(0 0 30px ${acc}) drop-shadow(0 12px 18px rgba(0,0,0,.6))}.hero svg{width:100%;height:100%}.edge{position:absolute;inset:0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}
</style></head><body><div class="bg"></div><div class="sh"></div><div class="glow"></div>
<div class="ic">${ICONS[g.id] || ''}</div><div class="t">${g.title}</div><div class="s">${g.sub.normalize('NFD').replace(/\u0301/g,'').toUpperCase().normalize('NFC')}</div>${hero ? `<div class="hero">${ICONS[g.id]}</div>` : ''}<div class="edge"></div></body></html>`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `/data/projects/tv-game/img/covers/${g.id}.jpg`, type: 'jpeg', quality: 84 });
    console.log(g.id, g.title);
  }
  await b.close();
})();
