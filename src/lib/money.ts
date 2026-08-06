/** Tiền luôn lưu bằng số nguyên VND, không có phần thập phân. */

export function formatVnd(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return sign + abs.toLocaleString("vi-VN") + " ₫";
}

export function formatShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} tr`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

function trim(n: number): string {
  return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, "").replace(".", ",");
}

/**
 * Đọc số tiền người dùng gõ tay: "150k", "1.2tr", "250.000", "1,5 triệu".
 * Trả về số nguyên VND, hoặc null nếu không hiểu được.
 */
export function parseVnd(input: string): number | null {
  // "đồng" phải đứng trước "đ" trong nhóm thay thế. Không dùng \b vì "đ"
  // không phải ký tự ASCII nên \b không tạo ranh giới từ như mong đợi.
  const raw = input.trim().toLowerCase().replace(/₫|vnd|đồng|đ/g, "").trim();
  if (!raw) return null;

  const m = raw.match(/^([\d.,\s]+)\s*(ty|tỷ|tr|trieu|triệu|m|k|nghin|nghìn|ngan|ngàn)?$/);
  if (!m) return null;

  const numPart = m[1].replace(/\s/g, "");
  const unit = m[2];

  let value: number;
  if (unit) {
    // Có đơn vị: dấu . và , đều là dấu thập phân — "1.2tr", "1,5 triệu"
    const normalized = numPart.replace(/[.,]/g, ".");
    if ((normalized.match(/\./g) || []).length > 1) return null;
    value = Number(normalized);
  } else {
    // Không đơn vị: dấu . và , là phân cách nghìn — "250.000", "1,250,000"
    value = Number(numPart.replace(/[.,]/g, ""));
  }
  if (!Number.isFinite(value)) return null;

  const factor =
    unit === "ty" || unit === "tỷ"
      ? 1_000_000_000
      : unit === "tr" || unit === "trieu" || unit === "triệu" || unit === "m"
        ? 1_000_000
        : unit
          ? 1_000
          : 1;

  return Math.round(value * factor);
}

/**
 * Chia `total` theo trọng số, đảm bảo tổng các phần bằng đúng `total`.
 * Phần dư (đồng lẻ) được rải cho những người có trọng số lớn nhất trước.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v), w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);

  const result = [...floors];
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    result[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}
