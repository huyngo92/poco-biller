export type SplitMode = "equal" | "shares" | "percent" | "exact";

export const SPLIT_MODE_LABEL: Record<SplitMode, string> = {
  equal: "Chia đều",
  shares: "Theo phần",
  percent: "Theo phần trăm",
  exact: "Nhập tay từng người",
};

export const CATEGORIES = [
  { id: "an-uong", label: "Ăn uống" },
  { id: "ca-phe", label: "Cà phê" },
  { id: "di-lai", label: "Đi lại" },
  { id: "luu-tru", label: "Lưu trú" },
  { id: "giai-tri", label: "Giải trí" },
  { id: "mua-sam", label: "Mua sắm" },
  { id: "hoa-don", label: "Hoá đơn cố định" },
  { id: "khac", label: "Khác" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Khác";
}

export type Member = {
  userId: number;
  name: string;
  email: string;
  role: "admin" | "member";
  avatar: string;
};

export type Group = {
  id: number;
  name: string;
  inviteCode: string;
  role: "admin" | "member";
};

export type BillShare = {
  userId: number;
  name: string;
  amount: number;
};

export type Bill = {
  id: number;
  groupId: number;
  title: string;
  category: string;
  total: number;
  paidBy: number;
  paidByName: string;
  spentOn: string;
  note: string;
  splitMode: SplitMode;
  source: string;
  createdBy: number;
  createdByName: string;
  shares: BillShare[];
};

export type Settlement = {
  id: number;
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: number;
  paidOn: string;
  note: string;
};

export type Balance = {
  userId: number;
  name: string;
  avatar: string;
  paid: number;
  owed: number;
  /** Dương = được nhận lại, âm = còn phải trả */
  net: number;
};

export type Transfer = {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: number;
};

export type PeriodKind = "week" | "month" | "quarter" | "all";

/** Người đang đăng nhập. Khai báo ở đây để client component dùng được
 *  mà không phải import từ lib/auth (file có next/headers và better-sqlite3). */
export type SessionUser = { id: number; email: string; name: string; avatar: string };

/** Kết quả AI đọc từ ảnh hoá đơn. */
export type OcrResult = {
  title: string;
  total: number;
  category: string;
  spentOn: string;
  items: { name: string; quantity: number; price: number }[];
  note: string;
};

/** Bill nháp do AI dựng từ câu mô tả trong chat. */
export type ChatDraft = {
  title: string;
  category: string;
  total: number;
  paidBy: number;
  spentOn: string;
  splitMode: SplitMode;
  note: string;
  shares: { userId: number; name: string; weight: number; amount: number }[];
  explanation: string;
};
