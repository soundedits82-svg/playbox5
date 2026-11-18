'use strict';
// PLAYBOX 5 hub: static files for /tv and /pad, plus a WebSocket relay (/ws) for pairing and controller input.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { accept } = require('./ws'), { toSVG } = require('./qr');
const ROOT = path.join(__dirname, '..'), MAX_PADS = 4, SLOT_HOLD_MS = 10 * 60 * 1000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const lanIP = () => Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
const clamp = (n, a, b) => Math.max(a, Math.min(b, +n || 0));
const send = (ws, o) => { if (ws && ws.open) ws.send(JSON.stringify(o)); };

function start(port = +process.env.PORT || 8080) {
  const sessions = new Map(), fails = new Map();
  let boundPort = port;
  const newSession = () => {
    let code; do code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); while ([...sessions.values()].some(s => s.code === code));
    const s = { sid: crypto.randomBytes(8).toString('hex'), code, tv: null, pads: Array(MAX_PADS).fill(null) };
    sessions.set(s.sid, s); return s;
  };
  const info = s => {
    const publicBase = (process.env.PLAYBOX_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    const url = publicBase ? `${publicBase}/pad/?c=${s.code}` : `http://${process.env.PLAYBOX_HOST || lanIP() || 'localhost'}:${boundPort}/pad/?c=${s.code}`;
    return { t: 'session', sid: s.sid, code: s.code, url, qr: toSVG(url), pads: s.pads.map(p => p && { name: p.name, on: !!(p.ws && p.ws.open) }) };
  };
  const tellPads = (s, o) => s.pads.forEach(p => p && send(p.ws, o));
  const slotFree = p => !p || (!(p.ws && p.ws.open) && Date.now() - p.off > SLOT_HOLD_MS);

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(302, { Location: '/tv/' }); return res.end(); }
    if (u.pathname === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
    let rel; try { rel = decodeURIComponent(u.pathname); } catch { res.writeHead(400); return res.end(); }
    let file = path.join(ROOT, rel);
    if (!['tv', 'pad'].includes(rel.split('/')[1]) || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('Not found'); }
    if (rel.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    });
  });

  server.on('upgrade', (req, sock) => {
    if (!req.url.startsWith('/ws')) return sock.destroy();
    const ip = req.socket.remoteAddress; let role = null, s = null, slot = 0;
    const fail = code => {
      const f = fails.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 60000) { f.n = 0; f.t = Date.now(); }
      f.n++; fails.set(ip, f); send(ws, { t: 'err', code });
    };
    const bind = (sess, i, pad) => { s = sess; slot = i; role = 'pad'; send(ws, { t: 'joined', slot: i + 1, token: pad.token, tv: !!(s.tv && s.tv.open) }); send(s.tv, { t: 'pad', slot: i + 1, name: pad.name, on: true }); };
    const ws = accept(req, sock, raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'ping') return send(ws, { t: 'pong', ts: m.ts });
      if (!role && m.t === 'tv') {
        const old = sessions.get(m.sid); s = old && !(old.tv && old.tv.open) ? old : newSession();
        role = 'tv'; s.tv = ws; send(ws, info(s)); return tellPads(s, { t: 'tv', on: true });
      }
      if (!role && m.t === 'join') {
        const f = fails.get(ip); if (f && Date.now() - f.t < 60000 && f.n >= 5) return send(ws, { t: 'err', code: 'rate_limited' });
        const sess = [...sessions.values()].find(x => x.code === String(m.code));
        if (!sess) return fail('bad_code');
        const i = sess.pads.findIndex(slotFree); if (i < 0) return send(ws, { t: 'err', code: 'full' });
        const pad = { token: crypto.randomBytes(16).toString('hex'), name: String(m.name || 'Phone').slice(0, 24), ws, off: 0 };
        sess.pads[i] = pad; return bind(sess, i, pad);
      }
      if (!role && m.t === 'resume') {
        for (const sess of sessions.values()) { const i = sess.pads.findIndex(p => p && p.token === m.token);
          if (i >= 0) { const pad = sess.pads[i]; if (pad.ws && pad.ws.open) pad.ws.close(); pad.ws = ws; return bind(sess, i, pad); } }
        return send(ws, { t: 'err', code: 'bad_token' });
      }
      if (role === 'pad' && (m.t === 'b' || m.t === 's')) {
        const out = m.t === 'b' ? { t: 'b', s: slot + 1, k: String(m.k).slice(0, 12), d: m.d ? 1 : 0 }
          : { t: 's', s: slot + 1, k: m.k === 'r' ? 'r' : 'l', x: clamp(m.x, -1, 1), y: clamp(m.y, -1, 1) };
        return send(s.tv, out);
      }
      if (role === 'tv' && m.t === 'rumble') { const p = s.pads[(+m.slot || 0) - 1]; send(p && p.ws, { t: 'rumble', ms: clamp(m.ms, 0, 1000) }); }
      if (role === 'tv' && m.t === 'kick') { const p = s.pads[(+m.slot || 0) - 1]; if (p) { send(p.ws, { t: 'err', code: 'kicked' }); p.ws && p.ws.close(); s.pads[m.slot - 1] = null; } }
    }, () => {
      if (role === 'tv' && s.tv === ws) { s.tv = null; tellPads(s, { t: 'tv', on: false }); }
      if (role === 'pad' && s.pads[slot] && s.pads[slot].ws === ws) { s.pads[slot].ws = null; s.pads[slot].off = Date.now(); send(s.tv, { t: 'pad', slot: slot + 1, on: false }); }
    });
  });

  return new Promise(resolve => server.listen(port, () => { boundPort = server.address().port;
    resolve({ port: boundPort, close: () => { server.closeAllConnections(); server.close(); } }); }));
}
module.exports = { start };
if (require.main === module) start().then(({ port }) => {
  const publicBase = (process.env.PLAYBOX_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  const base = publicBase || `http://${process.env.PLAYBOX_HOST || lanIP() || 'localhost'}:${port}`;
  console.log(`PLAYBOX 5 hub running\n  TV (open on the television): ${base}/tv/\n  Phone pad: ${base}/pad/`);
});
