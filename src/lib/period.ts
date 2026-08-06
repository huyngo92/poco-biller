import type { PeriodKind } from "./types";

export type Period = {
  kind: PeriodKind;
  /** yyyy-mm-dd, bao gồm */
  from: string;
  /** yyyy-mm-dd, bao gồm */
  to: string;
  label: string;
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function today(): string {
  return iso(new Date());
}

/** Tuần bắt đầu từ thứ Hai. `offset` = 0 tuần này, -1 tuần trước. */
export function resolvePeriod(kind: PeriodKind, offset = 0, base = new Date()): Period {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  if (kind === "all") {
    return { kind, from: "0000-01-01", to: "9999-12-31", label: "Tất cả" };
  }

  if (kind === "week") {
    const dow = (d.getDay() + 6) % 7; // 0 = thứ Hai
    const start = new Date(d);
    start.setDate(d.getDate() - dow + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const label =
      offset === 0
        ? "Tuần này"
        : offset === -1
          ? "Tuần trước"
          : `Tuần ${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
    return { kind, from: iso(start), to: iso(end), label };
  }

  if (kind === "month") {
    const start = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
    const label =
      offset === 0
        ? "Tháng này"
        : `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`;
    return { kind, from: iso(start), to: iso(end), label };
  }

  // quarter
  const q = Math.floor(d.getMonth() / 3) + offset;
  const start = new Date(d.getFullYear(), q * 3, 1);
  const end = new Date(d.getFullYear(), q * 3 + 3, 0);
  const label =
    offset === 0
      ? "Quý này"
      : `Quý ${Math.floor(start.getMonth() / 3) + 1}/${start.getFullYear()}`;
  return { kind, from: iso(start), to: iso(end), label };
}

/**
 * Nhãn ngắn để ghi dưới cột chart, ví dụ "T8" hoặc "12/8".
 * Nhãn dài của `resolvePeriod` ("Tháng này") không vẽ được vào 40px.
 */
export function shortPeriodLabel(p: Period): string {
  const [y, m, d] = p.from.split("-");
  if (p.kind === "week") return `${Number(d)}/${Number(m)}`;
  if (p.kind === "month") return `T${Number(m)}`;
  if (p.kind === "quarter") return `Q${Math.floor((Number(m) - 1) / 3) + 1}`;
  return y;
}

/**
 * `count` kỳ liền nhau, kỳ cuối là kỳ đang xem. Dùng cho chart xu hướng.
 * `kind = "all"` không có xu hướng nên trả mảng rỗng.
 */
export function recentPeriods(
  kind: PeriodKind,
  offset = 0,
  count = 6,
  base = new Date()
): Period[] {
  if (kind === "all") return [];
  const out: Period[] = [];
  for (let i = count - 1; i >= 0; i--)
    out.push(resolvePeriod(kind, offset - i, base));
  return out;
}

export function formatDateVn(isoDate: string): string {
  const [y, m, dd] = isoDate.split("-");
  if (!y || !m || !dd) return isoDate;
  return `${dd}/${m}/${y}`;
}

/** Số ngày đã qua kể từ `isoDate`. Dùng để đánh dấu nợ để lâu. */
export function daysSince(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y) return 0;
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((start - then) / 86_400_000);
}

/** Nợ để quá lâu thì nhắc gắt hơn. */
export function overdueLabel(isoDate: string): string | null {
  const days = daysSince(isoDate);
  if (days >= 60) return `${Math.floor(days / 30)} tháng`;
  if (days >= 14) return `${Math.floor(days / 7)} tuần`;
  return null;
}
