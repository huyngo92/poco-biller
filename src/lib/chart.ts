/**
 * Toán học cho chart — thuần hàm, không import React, không chạm DOM.
 *
 * Tách khỏi component để test được bằng scripts/test-logic.mjs (sandbox không
 * chạy được test runner có JSX).
 */

import type { CategoryId } from "./types";
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

/**
 * Tính phần trăm hiển thị trong legend donut.
 * Tách khỏi phần vẽ path (Visx tự tính) để test được bằng số.
 */
export function donutPercents(
  data: { category: string; amount: number }[]
): { category: string; percent: number }[] {
  const total = data.reduce((a, b) => a + b.amount, 0);
  if (total <= 0) return [];
  return data.map((d) => ({
    category: d.category,
    percent: Math.round((d.amount / total) * 100),
  }));
}

export function categoryLabelSafe(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Khác";
}

/* ---------- tiện ích chung ---------- */

/** Phần trăm thay đổi so với giá trị trước. `null` khi không so được. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
