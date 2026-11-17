const { chromium } = require('/app/node_modules/playwright');
const ids = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/ms-playwright/chromium-1254/chrome-linux64/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('pageerror', (e) => console.log('ERR', e.message));
  for (const id of ids) {
    const [gid, wait] = id.split(':');
    await pg.goto('http://127.0.0.1:8811/index.html', { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__tv);
    await pg.evaluate((gid) => {
      const tv = __tv; tv.pickGame(gid);
      tv.S.players.push({ cid: 'a', name: 'Γκας', color: TVP.COLORS[0], conn: null, connected: true, cups: [], throws: 0, made: 0 });
      tv.startGame();
    }, gid);
    await pg.waitForTimeout(+(wait || 7000));
    await pg.evaluate(() => { document.querySelector('#hud').hidden = true; });
    await pg.screenshot({ path: `/tmp/cov/raw-${gid}.png` });
    console.log('ok', gid);
  }
  await b.close();
})();
