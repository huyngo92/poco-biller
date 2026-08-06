/**
 * Toán học cho chart — thuần hàm, không import React, không chạm DOM.
 *
 * Tách khỏi component để test được bằng scripts/test-logic.mjs (sandbox không
 * chạy được test runner có JSX).
 */

import type { Bill, CategoryId } from "./types";
import { CATEGORIES } from "./types";

/* ---------- màu cho từng hạng mục ---------- */

/**
 * Mỗi hạng mục một màu cố định, lấy từ bộ system colors của iOS.
 * Cố định theo id (không theo thứ tự sắp xếp) để hạng mục luôn giữ đúng màu
 * dù kỳ này nó tụt xuống cuối danh sách.
 *
 * Giá trị là tên CSS custom property, khai báo trong globals.css để dark mode
 * ghi đè được.
 */
export const CATEGORY_VAR: Record<CategoryId, string> = {
  "an-uong": "--c-orange",
  "ca-phe": "--c-brown",
  "di-lai": "--c-blue",
  "luu-tru": "--c-indigo",
  "giai-tri": "--c-pink",
  "mua-sam": "--c-purple",
  "hoa-don": "--c-teal",
  khac: "--c-gray",
};

export function categoryColor(id: string): string {
  const v = CATEGORY_VAR[id as CategoryId] ?? "--c-gray";
  return `var(${v})`;
}

/* ---------- donut ---------- */

export type DonutSlice = {
  key: string;
  label: string;
  amount: number;
  /** 0-100, đã làm tròn để hiển thị */
  percent: number;
  color: string;
  /** Thuộc tính `d` của <path> cung tròn */
  d: string;
};

/**
 * Dựng các cung của donut. Vẽ bằng <path> arc chứ không phải stroke-dasharray
 * vì dasharray không cho đặt khe hở giữa các cung một cách chính xác khi
 * lát cắt quá nhỏ.
 *
 * Hệ toạ độ: hình vuông `size` x `size`, tâm ở giữa.
 */
export function donutSlices(
  data: { category: string; amount: number }[],
  opts: { size: number; thickness: number; gapDeg?: number } = {
    size: 120,
    thickness: 22,
  }
): DonutSlice[] {
  const total = data.reduce((a, b) => a + b.amount, 0);
  if (total <= 0) return [];

  const { size, thickness } = opts;
  const gapDeg = opts.gapDeg ?? 2;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter - thickness;

  // Bỏ khe hở khi chỉ có một lát — nếu không sẽ thấy một vết cắt lơ lửng
  const gap = data.length > 1 ? gapDeg : 0;

  let cursor = -90; // bắt đầu từ 12 giờ, chạy theo chiều kim đồng hồ
  const out: DonutSlice[] = [];

  for (const item of data) {
    const sweep = (item.amount / total) * 360;
    const a0 = cursor + gap / 2;
    const a1 = cursor + sweep - gap / 2;
    cursor += sweep;

    // Lát quá mỏng thì khe hở sẽ ăn hết cung — vẽ tối thiểu 0.5°
    const end = Math.max(a1, a0 + 0.5);

    out.push({
      key: item.category,
      label: categoryLabelSafe(item.category),
      amount: item.amount,
      percent: Math.round((item.amount / total) * 100),
      color: categoryColor(item.category),
      d: arcPath(cx, cy, rOuter, rInner, a0, end),
    });
  }
  return out;
}

function categoryLabelSafe(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Khác";
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Cung hình vành khuyên, đóng kín thành một path duy nhất. */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number
): string {
  // Cung đúng 360° có điểm đầu trùng điểm cuối, và SVG bỏ qua arc như vậy —
  // nó sẽ không vẽ gì cả. Chia thành hai nửa để vành khuyên hiện ra.
  if (a1 - a0 >= 359.99) {
    const half = a0 + 180;
    return (
      arcPath(cx, cy, rOuter, rInner, a0, half) +
      " " +
      arcPath(cx, cy, rOuter, rInner, half, a1 - 0.01)
    );
  }

  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, a0);
  const o1 = polar(cx, cy, rOuter, a1);
  const i1 = polar(cx, cy, rInner, a1);
  const i0 = polar(cx, cy, rInner, a0);
  return [
    `M ${r(o0.x)} ${r(o0.y)}`,
    `A ${r(rOuter)} ${r(rOuter)} 0 ${large} 1 ${r(o1.x)} ${r(o1.y)}`,
    `L ${r(i1.x)} ${r(i1.y)}`,
    `A ${r(rInner)} ${r(rInner)} 0 ${large} 0 ${r(i0.x)} ${r(i0.y)}`,
    "Z",
  ].join(" ");
}

/** Làm gọn số trong path — 2 chữ số thập phân là đủ mượt ở mọi màn hình. */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------- cột theo ngày ---------- */

export type Bucket = { key: string; label: string; amount: number };

/**
 * Gộp bill thành các cột theo ngày, phủ kín từ `from` đến `to` (ngày không có
 * bill vẫn có cột giá trị 0 — thiếu nó thì mắt đọc sai nhịp chi tiêu).
 *
 * Kỳ dài hơn 31 ngày (quý, "tất cả") thì gộp theo tuần cho khỏi thành rừng cột.
 */
export function dailyBuckets(
  bills: Pick<Bill, "spentOn" | "total">[],
  from: string,
  to: string
): { buckets: Bucket[]; unit: "day" | "week"; unitLabel: string } {
  const start = parseIso(from);
  const end = parseIso(to);
  if (!start || !end || end < start)
    return { buckets: [], unit: "day", unitLabel: "ngày" };

  const days = Math.round((end - start) / 86_400_000) + 1;
  // Tới 31 cột (một tháng đầy) vẫn đọc được; dài hơn thì gộp theo tuần.
  const unit: "day" | "week" = days > 31 ? "week" : "day";
  // Trần số cột. Vượt trần thì nới bước gộp chứ không cắt bớt đuôi, để không
  // bill nào rơi khỏi chart khi kỳ dài (ví dụ xem "Tất cả").
  const MAX_COLS = unit === "day" ? 31 : 26;
  const step = unit === "week" ? Math.max(7, Math.ceil(days / MAX_COLS)) : 1;
  const count = Math.min(Math.ceil(days / step), MAX_COLS);

  const buckets: Bucket[] = [];
  const index = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const d = new Date(start + i * step * 86_400_000);
    const key = isoOf(d);
    index.set(key, i);
    buckets.push({
      key,
      label:
        unit === "week"
          ? `${d.getDate()}/${d.getMonth() + 1}`
          : String(d.getDate()),
      amount: 0,
    });
  }

  for (const b of bills) {
    const t = parseIso(b.spentOn);
    if (t === null || t < start) continue;
    const i = Math.floor((t - start) / 86_400_000 / step);
    if (i >= 0 && i < count) buckets[i].amount += b.total;
  }

  // Bước gộp có thể to hơn 7 ngày khi kỳ rất dài — nói đúng cho người đọc
  const unitLabel =
    step === 1 ? "ngày" : step === 7 ? "tuần" : `${step} ngày`;

  return { buckets, unit, unitLabel };
}

function parseIso(s: string): number | null {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d).getTime();
  return Number.isFinite(t) ? t : null;
}

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- tiện ích chung ---------- */

/** Phần trăm thay đổi so với giá trị trước. `null` khi không so được. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Toạ độ đường sparkline. Một điểm thì trả về đoạn nằm ngang giữa khung
 * (vẽ một điểm đơn lẻ thành đường sẽ ra path rỗng).
 *
 * `pad` chừa lề cả bốn phía: thiếu lề ngang thì nét 2px ở điểm đầu và điểm
 * cuối bị mép SVG cắt mất một nửa.
 */
export function sparkPoints(
  values: number[],
  w: number,
  h: number,
  pad = 2
): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  const innerH = h - pad * 2;
  const innerW = w - pad * 2;
  if (values.length === 1)
    return [
      { x: pad, y: pad + innerH / 2 },
      { x: w - pad, y: pad + innerH / 2 },
    ];
  const stepX = innerW / (values.length - 1);
  return values.map((v, i) => ({
    x: r(pad + i * stepX),
    y: r(pad + innerH * (1 - v / max)),
  }));
}
