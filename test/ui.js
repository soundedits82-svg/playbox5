'use strict';
// Browser end-to-end test (Playwright + Chromium): TV remote navigation, QR pairing page, phone input driving the TV.
// Run: NODE_PATH=$(npm root -g) node test/ui.js
const { chromium } = require('playwright'), assert = require('node:assert/strict'), path = require('path');
const { start } = require('../server/server'); const OUT = path.join(__dirname, '..', 'reports', 'shots');
(async () => {
  const srv = await start(0), base = `http://127.0.0.1:${srv.port}`, b = await chromium.launch(), res = [];
  const ok = (n, f) => f().then(() => { res.push(['PASS', n]); }, e => { res.push(['FAIL', n + ' -> ' + e.message.split('\n')[0]]); });
  const tvc = await b.newContext({ viewport: { width: 1280, height: 720 } }), tv = await tvc.newPage(), errs = [];
  tv.on('pageerror', e => errs.push(e.message)); tv.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const S = () => tv.evaluate(() => window.__pb.state()), key = k => tv.keyboard.press(k);
  await tv.goto(base + '/tv/?boot=0'); await tv.waitForTimeout(900);
  await ok('home renders 8 shelf tiles and Orb Rush is selected', async () => { assert.equal(await tv.locator('.tile').count(), 8); assert.equal((await S()).sel, 1); assert.equal(await tv.textContent('#h1'), 'Orb Rush'); });
  await tv.waitForTimeout(600); await tv.screenshot({ path: path.join(OUT, 'tv-home.png') });
  await ok('remote: Right/Left moves shelf selection and updates hero', async () => { await key('ArrowRight'); assert.equal((await S()).sel, 2); assert.equal(await tv.textContent('#h1'), 'Import Your Games'); await key('ArrowLeft'); assert.equal((await S()).sel, 1); });
  await ok('remote: Down reaches hero buttons, Up returns, Up again reaches top bar', async () => { await key('ArrowDown'); assert.equal((await S()).r, 'hero'); await key('ArrowUp'); await key('ArrowUp'); assert.equal((await S()).r, 'top'); });
  await ok('coming-soon items show a toast instead of a fake launch', async () => { await key('ArrowDown'); await key('ArrowRight'); await key('Enter'); await tv.waitForTimeout(200); assert.match(await tv.textContent('#toast'), /coming soon/i); assert.equal((await S()).game, false); await key('ArrowLeft'); });
  await key('ArrowUp'); for (let i = 0; i < 2; i++) await key('ArrowRight'); await key('Enter');
  await ok('controller icon opens pairing panel with code + QR', async () => { assert.equal((await S()).panel, true); await tv.waitForTimeout(200); assert.match(await tv.textContent('#code'), /^\d{3} \d{3}$/); assert.ok(await tv.locator('#qr svg').count()); });
  await tv.screenshot({ path: path.join(OUT, 'tv-pairing.png') });
  const url = (await tv.textContent('#url')).trim();
  const pc = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile' }), ph = await pc.newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto('http://' + url.replace(/^[\d.]+|^localhost/, '127.0.0.1').replace(/:\d+/, ':' + srv.port));
  await ok('phone opens QR URL and pairs automatically; TV shows Player 1', async () => { await ph.waitForSelector('#pad', { state: 'visible' }); await tv.waitForFunction(() => window.__pb.state().pads.includes('1')); assert.match(await tv.textContent('#slots li:first-child'), /connected/); });
  await ph.waitForTimeout(2300); await ph.screenshot({ path: path.join(OUT, 'phone-pad.png') });
  await ok('phone reports round-trip latency', async () => assert.match(await ph.textContent('#info'), /Player 1 · \d+ ms/));
  await tv.keyboard.press('Escape');
  const press = async k => { const bx = await ph.locator(`[data-k=${k}]`).boundingBox(); await ph.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await ph.mouse.down(); await ph.waitForTimeout(60); await ph.mouse.up(); await ph.waitForTimeout(60); };
  await ok('phone D-pad navigates the TV menu (down to shelf, right/left changes selection)', async () => { await press('down'); assert.equal((await S()).r, 'shelf'); await press('right'); assert.equal((await S()).sel, 2); await press('left'); assert.equal((await S()).sel, 1); });
  await ok('phone Cross launches the focused game; Circle exits it', async () => { await press('cross'); assert.equal((await S()).game, true); await press('circle'); assert.equal((await S()).game, false); });
  await press('cross'); await tv.waitForTimeout(150);
  await ok('phone left stick moves the player on the TV', async () => {
    const x0 = (await S()).players['1'].x, r = await ph.locator('[data-s=l]').boundingBox(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    await ph.mouse.move(cx, cy); await ph.mouse.down(); await ph.mouse.move(cx + r.width / 2, cy, { steps: 4 }); await tv.waitForTimeout(500); const x1 = (await S()).players['1'].x;
    await tv.screenshot({ path: path.join(OUT, 'tv-game.png') }); await ph.mouse.up(); await tv.waitForTimeout(200);
    const x2 = (await S()).players['1'].x; await tv.waitForTimeout(300); const x3 = (await S()).players['1'].x; assert.ok(x1 > x0 + 100, `moved ${x1 - x0}`); assert.ok(Math.abs(x3 - x2) < 1, 'player stops when stick released'); });
  await ok('phone auto-reconnects after a dropped socket and keeps Player 1', async () => { await ph.evaluate(() => window.__pad.drop()); await tv.waitForFunction(() => !window.__pb.state().pads.includes('1'), null, { timeout: 3000 }); await tv.waitForFunction(() => window.__pb.state().pads.includes('1'), null, { timeout: 6000 }); assert.equal((await ph.evaluate(() => window.__pad.state())).slot, 1); });
  await ok('no uncaught page errors', async () => assert.deepEqual(errs, []));
  console.log(res.map(r => r.join('  ')).join('\n')); console.log(`\n${res.filter(r => r[0] === 'PASS').length}/${res.length} passed`);
  await b.close(); srv.close(); process.exit(res.some(r => r[0] === 'FAIL') ? 1 : 0);
})();
