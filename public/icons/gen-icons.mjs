import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function canvas(size) {
  return Buffer.alloc(size * size * 4);
}

function setPx(buf, size, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const sa = a / 255;
  const da = buf[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / oa);
  buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / oa);
  buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}

function fillCircle(buf, size, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(buf, size, x, y, color);
    }
  }
}

function fillRect(buf, size, x0, y0, x1, y1, color) {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(size - 1, Math.ceil(y1)); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(size - 1, Math.ceil(x1)); x += 1) {
      setPx(buf, size, x, y, color);
    }
  }
}

function inSpade(px, py, cx, cy, r) {
  const x = (px - cx) / r;
  const y = (py - cy) / r;
  const lobeL = (x + 0.42) ** 2 + (y - 0.42) ** 2 <= 0.55 ** 2;
  const lobeR = (x - 0.42) ** 2 + (y - 0.42) ** 2 <= 0.55 ** 2;
  const tri = y >= -1.05 && y <= 0.2 && Math.abs(x) <= 0.8 * (y + 1.05) / 1.25 + 0.05;
  const stem = Math.abs(x) <= 0.09 && y >= 0.1 && y <= 0.75;
  return lobeL || lobeR || tri || stem;
}

function drawChip(buf, size, cx, cy, radius, bg, rim, inner, mark) {
  fillCircle(buf, size, cx, cy, radius, bg);
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    fillCircle(buf, size, cx + Math.cos(a) * radius * 0.86, cy + Math.sin(a) * radius * 0.86, radius * 0.1, rim);
  }
  fillCircle(buf, size, cx, cy, radius * 0.62, inner);
  const sr = radius * 0.42;
  for (let y = Math.floor(cy - sr * 1.4); y <= Math.ceil(cy + sr * 1.4); y += 1) {
    for (let x = Math.floor(cx - sr * 1.2); x <= Math.ceil(cx + sr * 1.2); x += 1) {
      if (inSpade(x, y, cx, cy - sr * 0.05, sr)) setPx(buf, size, x, y, mark);
    }
  }
}

const GREEN = [11, 61, 46, 255];
const DARK = [7, 39, 30, 255];
const LIGHT = [20, 86, 63, 255];
const CREAM = [245, 240, 230, 255];

function makeIcon(size, { maskable = false } = {}) {
  const buf = canvas(size);
  if (maskable) fillRect(buf, size, 0, 0, size, size, DARK);
  const c = size / 2;
  drawChip(buf, size, c, c, maskable ? size * 0.44 : size * 0.47, maskable ? GREEN : GREEN, CREAM, LIGHT, CREAM);
  return encodePNG(size, buf);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192));
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512));
writeFileSync(join(outDir, 'icon-maskable-512.png'), makeIcon(512, { maskable: true }));
writeFileSync(join(outDir, 'apple-touch-icon.png'), makeIcon(180, { maskable: true }));
console.log('icons written to', outDir);
