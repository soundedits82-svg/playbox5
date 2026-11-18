'use strict';
// Protocol-level end-to-end tests: real HTTP server, real WebSocket clients (Node's built-in WebSocket).
const test = require('node:test'), assert = require('node:assert/strict');
const { start } = require('../server/server'), { encode } = require('../server/qr');
const open = port => new Promise((res, rej) => {
  const w = new WebSocket(`ws://127.0.0.1:${port}/ws`); w.q = []; w.waiters = [];
  w.onmessage = e => { const m = JSON.parse(e.data), i = w.waiters.findIndex(x => x.f(m)); if (i >= 0) w.waiters.splice(i, 1)[0].r(m); else w.q.push(m); };
  w.j = o => w.send(JSON.stringify(o));
  w.next = (f = () => true, ms = 1500) => new Promise((r, j) => { const i = w.q.findIndex(f); if (i >= 0) return r(w.q.splice(i, 1)[0]); const o = { f, r }; w.waiters.push(o); setTimeout(() => { w.waiters = w.waiters.filter(x => x !== o); j(new Error('timeout waiting for message')); }, ms); });
  w.onopen = () => res(w); w.onerror = rej; });
const tvUp = async port => { const tv = await open(port); tv.j({ t: 'tv' }); return [tv, await tv.next(m => m.t === 'session')]; };
const join = async (port, code) => { const p = await open(port); p.j({ t: 'join', code, name: 'Test phone' }); return [p, await p.next(m => m.t === 'joined' || m.t === 'err')]; };
const http = async (port, p) => fetch(`http://127.0.0.1:${port}${p}`, { redirect: 'manual' });

test('hub', async t => {
  const srv = await start(0), port = srv.port, socks = [];
  t.after(() => { socks.forEach(s => s.close()); srv.close(); });
  const mk = async f => { const r = await f(); socks.push(r[0]); return r; };

  await t.test('HTTP: serves /tv and /pad, blocks traversal and other paths', async () => {
    assert.equal((await http(port, '/tv/')).status, 200); assert.equal((await http(port, '/pad/')).status, 200);
    assert.equal((await http(port, '/')).status, 302); assert.equal((await http(port, '/server/server.js')).status, 404);
    assert.equal((await http(port, '/tv/..%2F..%2Fetc%2Fpasswd')).status, 404);
  });
  await t.test('QR encoder output is a valid 29x29 matrix with finder patterns', () => {
    const m = encode('http://192.168.1.20:8080/pad/?c=123456'); assert.equal(m.length, 29);
    assert.ok(m[0][0] && m[0][6] && m[6][0] && !m[1][1] && m[2][2]);
  });
  let tv, session, p1, tok;
  await t.test('TV receives a session with 6-digit code, pairing URL and QR svg', async () => {
    [tv, session] = await mk(() => tvUp(port));
    assert.match(session.code, /^\d{6}$/); assert.ok(session.url.endsWith('/pad/?c=' + session.code)); assert.ok(session.qr.startsWith('<svg'));
  });
  await t.test('wrong code is rejected, correct code pairs as Player 1', async () => {
    const [bad, e] = await mk(() => join(port, '000000')); assert.equal(e.code, 'bad_code'); bad.close();
    let j; [p1, j] = await mk(() => join(port, session.code)); assert.equal(j.t, 'joined'); assert.equal(j.slot, 1); assert.ok(j.token.length >= 32); tok = j.token;
    assert.deepEqual(await tv.next(m => m.t === 'pad'), { t: 'pad', slot: 1, name: 'Test phone', on: true });
  });
  await t.test('buttons and sticks are relayed to the TV with slot, and values are clamped', async () => {
    p1.j({ t: 'b', k: 'cross', d: 1 }); assert.deepEqual(await tv.next(m => m.t === 'b'), { t: 'b', s: 1, k: 'cross', d: 1 });
    p1.j({ t: 's', k: 'l', x: 9, y: -9 }); assert.deepEqual(await tv.next(m => m.t === 's'), { t: 's', s: 1, k: 'l', x: 1, y: -1 });
  });
  await t.test('input latency phone->hub->TV on localhost (300 samples)', async () => {
    const xs = []; for (let i = 0; i < 300; i++) { const t0 = performance.now(); p1.j({ t: 'b', k: 'up', d: i & 1 }); await tv.next(m => m.t === 'b' && m.k === 'up'); xs.push(performance.now() - t0); }
    xs.sort((a, b) => a - b); const med = xs[150], p95 = xs[285]; console.log(`      latency ms: median ${med.toFixed(2)}, p95 ${p95.toFixed(2)}`); assert.ok(p95 < 25);
  });
  await t.test('rumble from TV reaches the phone, clamped to 1000 ms', async () => { tv.j({ t: 'rumble', slot: 1, ms: 99999 }); assert.deepEqual(await p1.next(m => m.t === 'rumble'), { t: 'rumble', ms: 1000 }); });
  await t.test('phone drop shows offline on TV, resume with token restores the same slot', async () => {
    p1.close(); assert.deepEqual(await tv.next(m => m.t === 'pad'), { t: 'pad', slot: 1, on: false });
    const p = await open(port); socks.push(p); p.j({ t: 'resume', token: tok }); const j = await p.next(m => m.t === 'joined'); assert.equal(j.slot, 1); assert.equal(j.token, tok);
    assert.equal((await tv.next(m => m.t === 'pad')).on, true); const q = await open(port); socks.push(q); q.j({ t: 'resume', token: 'nope' }); assert.equal((await q.next()).code, 'bad_token'); p1 = p;
  });
  await t.test('TV reload with its session id keeps code and pads; phone is told TV went offline/online', async () => {
    tv.close(); assert.deepEqual(await p1.next(m => m.t === 'tv'), { t: 'tv', on: false });
    const tv2 = await open(port); socks.push(tv2); tv2.j({ t: 'tv', sid: session.sid }); const s2 = await tv2.next(m => m.t === 'session');
    assert.equal(s2.code, session.code); assert.equal(s2.pads[0].on, true); assert.deepEqual(await p1.next(m => m.t === 'tv'), { t: 'tv', on: true });
  });
  await t.test('a 5th controller is refused (max 4)', async () => {
    for (let i = 0; i < 3; i++) { const [, j] = await mk(() => join(port, session.code)); assert.equal(j.t, 'joined'); }
    const [, e] = await mk(() => join(port, session.code)); assert.equal(e.code, 'full');
  });
  await t.test('input before pairing is ignored', async () => { const x = await open(port); socks.push(x); x.j({ t: 'b', k: 'cross', d: 1 }); x.j({ t: 'ping', ts: 7 }); assert.deepEqual(await x.next(), { t: 'pong', ts: 7 }); });
});
test('brute-force protection: 5 bad codes lock the client out for a minute', async t => {
  const srv = await start(0); t.after(() => srv.close()); const [tv, s] = await tvUp(srv.port);
  for (let i = 0; i < 5; i++) { const [p, e] = await join(srv.port, '00000' + i); assert.equal(e.code, 'bad_code'); p.close(); }
  const [p, e] = await join(srv.port, s.code); assert.equal(e.code, 'rate_limited'); p.close(); tv.close();
});
