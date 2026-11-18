'use strict';
// Minimal RFC 6455 server (text frames only, no fragmentation, 64 KB max) so the server has zero npm dependencies.
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function accept(req, socket, onMessage, onClose) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  socket.setNoDelay(true);
  let buf = Buffer.alloc(0);
  const frame = (op, payload) => {
    const n = payload.length, h = n < 126 ? Buffer.from([0x80 | op, n]) : Buffer.from([0x80 | op, 126, n >> 8, n & 255]);
    socket.write(Buffer.concat([h, payload]));
  };
  const ws = { open: true,
    send(s) { if (ws.open) frame(1, Buffer.from(s)); },
    close() { if (ws.open) { try { frame(8, Buffer.alloc(0)); } catch {} ws.open = false; socket.end(); } } };
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { socket.destroy(); return; }
      const masked = (buf[1] & 128) !== 0;
      if (buf.length < off + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(off, off + 4) : null; off += masked ? 4 : 0;
      const p = Buffer.from(buf.subarray(off, off + len));
      if (mask) for (let i = 0; i < len; i++) p[i] ^= mask[i & 3];
      const op = buf[0] & 15; buf = buf.subarray(off + len);
      if (op === 8) { ws.close(); return; }
      if (op === 9) frame(10, p);
      else if (op === 1) onMessage(p.toString());
    }
  });
  const end = () => { if (!ws.ended) { ws.open = false; ws.ended = true; onClose(); } };
  socket.on('close', end); socket.on('error', end);
  return ws;
}
module.exports = { accept };
