/**
 * Sinh apple-icon.png (180px) và favicon.ico từ cùng một hình với icon.svg.
 *
 * Vì sao không dùng thư viện render SVG: sandbox không cài được npm package,
 * và Safari trên iOS không nhận apple-touch-icon dạng SVG nên vẫn phải có PNG.
 * Hình chỉ gồm hình chữ nhật bo góc + hai nửa hình tròn, vẽ tay bằng
 * `node:zlib` + tự đóng gói PNG là đủ, không cần canvas.
 *
 * Chạy lại khi sửa src/app/icon.svg:  node scripts/gen-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");

/* ---------- hình học, toạ độ trong hệ 64x64 giống icon.svg ---------- */

const TOP = [10, 132, 255]; // #0a84ff
const BOTTOM = [0, 98, 204]; // #0062cc
const R_RECT = 14; // bo góc app icon iOS
// 21/32 khung: to hết mức mà vẫn còn lề xanh nhìn thấy ở 16px
const R_CIRCLE = 21;
// Khe 2px ở hệ 64 → còn 0.5px ở 16px, vừa đủ để khe không biến mất
const GAP_HALF = 2;

/** Độ phủ của pixel: lấy mẫu 4x4 rồi lấy trung bình, cho biên mượt. */
function coverage(px, py, size, inside) {
  const s = 4;
  let hit = 0;
  for (let sy = 0; sy < s; sy++)
    for (let sx = 0; sx < s; sx++) {
      const x = ((px + (sx + 0.5) / s) / size) * 64;
      const y = ((py + (sy + 0.5) / s) / size) * 64;
      if (inside(x, y)) hit++;
    }
  return hit / (s * s);
}

const inRoundedRect = (x, y) => {
  const cx = Math.min(Math.max(x, R_RECT), 64 - R_RECT);
  const cy = Math.min(Math.max(y, R_RECT), 64 - R_RECT);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= R_RECT * R_RECT;
};

const inCircle = (x, y) =>
  (x - 32) ** 2 + (y - 32) ** 2 <= R_CIRCLE * R_CIRCLE;

const inLeftHalf = (x, y) => inCircle(x, y) && x <= 32 - GAP_HALF;
const inRightHalf = (x, y) => inCircle(x, y) && x >= 32 + GAP_HALF;

/** Trộn màu `over` lên `base` với độ mờ `a`. */
function mix(base, over, a) {
  return base.map((c, i) => Math.round(c + (over[i] - c) * a));
}

/** RGBA thô, mỗi hàng có 1 byte filter 0 ở đầu — đúng định dạng PNG. */
function render(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    // Gradient dọc, nội suy theo tâm pixel
    const t = (y + 0.5) / size;
    const bg = TOP.map((c, i) => Math.round(c + (BOTTOM[i] - c) * t));
    for (let x = 0; x < size; x++) {
      const aRect = coverage(x, y, size, inRoundedRect);
      if (aRect === 0) continue; // ngoài icon → giữ trong suốt

      let rgb = bg;
      const aL = coverage(x, y, size, inLeftHalf);
      const aR = coverage(x, y, size, inRightHalf);
      if (aL > 0) rgb = mix(rgb, [255, 255, 255], aL);
      // Nửa phải chỉ 55% trắng — để mắt đọc ra "hai phần" ở size nhỏ
      if (aR > 0) rgb = mix(rgb, [255, 255, 255], aR * 0.55);

      const o = 1 + x * 4;
      row[o] = rgb[0];
      row[o + 1] = rgb[1];
      row[o + 2] = rgb[2];
      row[o + 3] = Math.round(aRect * 255);
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

/* ---------- đóng gói PNG ---------- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- favicon.ico bọc PNG 32 + 16 ---------- */

function ico(sizes) {
  const images = sizes.map((s) => ({ size: s, data: png(s) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const dir = [];
  for (const img of images) {
    const e = Buffer.alloc(16);
    e[0] = img.size === 256 ? 0 : img.size; // 0 nghĩa là 256
    e[1] = img.size === 256 ? 0 : img.size;
    e.writeUInt32LE(img.data.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += img.data.length;
  }
  return Buffer.concat([header, ...dir, ...images.map((i) => i.data)]);
}

/* ---------- ghi file ---------- */

writeFileSync(join(OUT, "apple-icon.png"), png(180));
writeFileSync(join(OUT, "favicon.ico"), ico([32, 16]));
console.log("Đã sinh apple-icon.png (180px) và favicon.ico (32+16px).");
