'use strict';
// Minimal dependency-free QR encoder: byte mode, ECC level L, versions 1-5, mask 0 (payload <= 106 bytes).
const DATA = [19, 34, 55, 80, 108], ECC = [7, 10, 15, 20, 26];
const EXP = new Array(512), LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rs(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const h = new Array(g.length + 1).fill(0); g.forEach((c, j) => { h[j] ^= c; h[j + 1] ^= mul(c, EXP[i]); }); g = h; }
  const r = new Array(n).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < n; i++) r[i] ^= mul(g[i + 1], f); }
  return r;
}
function encode(text) {
  const bytes = [...Buffer.from(text, 'utf8')];
  const v = DATA.findIndex(d => d >= bytes.length + 2);
  if (v < 0) throw new Error('QR payload too long');
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, DATA[v] * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0xEC; cw.length < DATA[v]; p ^= 0xFD) cw.push(p);
  const all = cw.concat(rs(cw, ECC[v]));
  const size = 17 + 4 * (v + 1);
  const m = Array.from({ length: size }, () => new Array(size).fill(false)), f = m.map(r => r.slice());
  const set = (x, y, d) => { m[y][x] = d; f[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); }
    }
  if (v >= 1) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(size - 7 + dx, size - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const fd = 1 << 3; let r = fd; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >> 9) * 0x537);
  const fb = ((fd << 10) | r) ^ 0x5412, bit = i => ((fb >> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!f[y][x] && k < all.length * 8) { m[y][x] = ((all[k >> 3] >> (7 - (k & 7))) & 1) === 1; k++; }
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!f[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];
  return m;
}
function toSVG(text) {
  const m = encode(text), n = m.length; let d = '';
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}"/></svg>`;
}
module.exports = { encode, toSVG };
