import type {
  Balance,
  Bill,
  Group,
  Member,
  Settlement,
  Transfer,
} from "./types";
import type { Period } from "./period";

/** Một điểm trên chart xu hướng: tổng chi của một kỳ. */
export type TrendPoint = { label: string; from: string; amount: number };

export type Overview = {
  period: Period;
  /** 6 kỳ gần nhất, kỳ cuối là kỳ đang xem. Rỗng khi xem "Tất cả". */
  trend: TrendPoint[];
  role: "admin" | "member";
  members: Member[];
  bills: Bill[];
  settlements: Settlement[];
  balances: Balance[];
  transfers: Transfer[];
  totals: {
    spent: number;
    billCount: number;
    byCategory: { category: string; amount: number }[];
  };
};

/** fetch JSON, ném Error với thông báo tiếng Việt từ server nếu có. */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Phản hồi không phải JSON
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Yêu cầu thất bại (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export function selectedGroupId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("poco.groupId");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function rememberGroupId(id: number) {
  if (typeof window !== "undefined")
    window.localStorage.setItem("poco.groupId", String(id));
}

/** Nhóm đang chọn, hoặc nhóm đầu tiên nếu lựa chọn cũ không còn hợp lệ. */
export function resolveGroup(groups: Group[]): Group | null {
  if (groups.length === 0) return null;
  const saved = selectedGroupId();
  return groups.find((g) => g.id === saved) ?? groups[0];
}
