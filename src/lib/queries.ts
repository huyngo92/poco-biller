import crypto from "node:crypto";
import { getDb } from "./db";
import { HttpError } from "./auth";
import { splitByWeights } from "./money";
import type {
  Bill,
  BillShare,
  Group,
  Member,
  Settlement,
  SplitMode,
} from "./types";

/* ---------- Nhóm & thành viên ---------- */

export function makeInviteCode(): string {
  // Bỏ các ký tự dễ đọc sai: 0/O, 1/I
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function listGroupsOfUser(userId: number): Group[] {
  return getDb()
    .prepare(
      `SELECT g.id, g.name, g.invite_code AS inviteCode, m.role
         FROM groups g JOIN memberships m ON m.group_id = g.id
        WHERE m.user_id = ?
        ORDER BY g.created_at`
    )
    .all(userId) as Group[];
}

export function createGroup(userId: number, name: string): Group {
  const db = getDb();
  return db.transaction(() => {
    let code = makeInviteCode();
    for (let i = 0; i < 5; i++) {
      const clash = db
        .prepare("SELECT 1 FROM groups WHERE invite_code = ?")
        .get(code);
      if (!clash) break;
      code = makeInviteCode();
    }
    const info = db
      .prepare(
        "INSERT INTO groups (name, invite_code, created_by) VALUES (?, ?, ?)"
      )
      .run(name, code, userId);
    const groupId = Number(info.lastInsertRowid);
    db.prepare(
      "INSERT INTO memberships (group_id, user_id, role) VALUES (?, ?, 'admin')"
    ).run(groupId, userId);
    return { id: groupId, name, inviteCode: code, role: "admin" as const };
  })();
}

export function joinGroup(userId: number, inviteCode: string): Group {
  const db = getDb();
  const group = db
    .prepare("SELECT id, name, invite_code AS inviteCode FROM groups WHERE invite_code = ?")
    .get(inviteCode.trim().toUpperCase()) as
    | { id: number; name: string; inviteCode: string }
    | undefined;
  if (!group) throw new HttpError(404, "Mã mời không đúng.");

  db.prepare(
    "INSERT OR IGNORE INTO memberships (group_id, user_id, role) VALUES (?, ?, 'member')"
  ).run(group.id, userId);

  return { ...group, role: "member" };
}

export function assertMember(groupId: number, userId: number): "admin" | "member" {
  const row = getDb()
    .prepare("SELECT role FROM memberships WHERE group_id = ? AND user_id = ?")
    .get(groupId, userId) as { role: "admin" | "member" } | undefined;
  if (!row) throw new HttpError(403, "Bạn không ở trong nhóm này.");
  return row.role;
}

export function listMembers(groupId: number): Member[] {
  return getDb()
    .prepare(
      `SELECT u.id AS userId, u.name, u.email, m.role
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.group_id = ?
        ORDER BY m.joined_at`
    )
    .all(groupId) as Member[];
}

export function removeMember(groupId: number, targetUserId: number): void {
  const db = getDb();
  const hasBills = db
    .prepare(
      `SELECT 1 FROM bills WHERE group_id = ? AND paid_by = ?
        UNION SELECT 1 FROM bill_shares s JOIN bills b ON b.id = s.bill_id
        WHERE b.group_id = ? AND s.user_id = ? LIMIT 1`
    )
    .get(groupId, targetUserId, groupId, targetUserId);
  if (hasBills)
    throw new HttpError(
      400,
      "Thành viên này đã có mặt trong bill nên không xoá được. Hãy xoá hoặc sửa các bill liên quan trước."
    );
  db.prepare("DELETE FROM memberships WHERE group_id = ? AND user_id = ?").run(
    groupId,
    targetUserId
  );
}

/* ---------- Bill ---------- */

export type ShareInput = { userId: number; weight?: number; amount?: number };

export type BillInput = {
  groupId: number;
  title: string;
  category: string;
  total: number;
  paidBy: number;
  spentOn: string;
  note?: string;
  splitMode: SplitMode;
  source?: string;
  shares: ShareInput[];
};

/** Quy đổi mọi kiểu chia về số tiền nguyên, tổng khớp đúng total. */
export function resolveShares(input: BillInput): { userId: number; amount: number }[] {
  const { splitMode, total, shares } = input;
  if (shares.length === 0)
    throw new HttpError(400, "Cần chọn ít nhất một người cùng chia.");

  if (splitMode === "exact") {
    const amounts = shares.map((s) => Math.round(s.amount ?? 0));
    const sum = amounts.reduce((a, b) => a + b, 0);
    if (sum !== total)
      throw new HttpError(
        400,
        `Tổng các phần (${sum.toLocaleString("vi-VN")} ₫) chưa khớp tổng bill (${total.toLocaleString("vi-VN")} ₫).`
      );
    return shares.map((s, i) => ({ userId: s.userId, amount: amounts[i] }));
  }

  const weights =
    splitMode === "equal"
      ? shares.map(() => 1)
      : shares.map((s) => Math.max(0, s.weight ?? 0));

  if (weights.reduce((a, b) => a + b, 0) <= 0)
    throw new HttpError(400, "Tỷ lệ chia phải lớn hơn 0.");

  const amounts = splitByWeights(total, weights);
  return shares.map((s, i) => ({ userId: s.userId, amount: amounts[i] }));
}

export function createBill(input: BillInput, createdBy: number): number {
  const db = getDb();
  const memberIds = new Set(listMembers(input.groupId).map((m) => m.userId));
  if (!memberIds.has(input.paidBy))
    throw new HttpError(400, "Người ứng tiền không thuộc nhóm.");
  for (const s of input.shares)
    if (!memberIds.has(s.userId))
      throw new HttpError(400, "Có người trong danh sách chia không thuộc nhóm.");

  const resolved = resolveShares(input);

  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO bills
           (group_id, title, category, total, paid_by, spent_on, note, split_mode, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.groupId,
        input.title,
        input.category,
        input.total,
        input.paidBy,
        input.spentOn,
        input.note ?? "",
        input.splitMode,
        input.source ?? "manual",
        createdBy
      );
    const billId = Number(info.lastInsertRowid);
    const stmt = db.prepare(
      "INSERT INTO bill_shares (bill_id, user_id, amount) VALUES (?, ?, ?)"
    );
    for (const s of resolved) stmt.run(billId, s.userId, s.amount);
    return billId;
  })();
}

export function deleteBill(billId: number, userId: number): void {
  const db = getDb();
  const bill = db
    .prepare("SELECT group_id AS groupId FROM bills WHERE id = ?")
    .get(billId) as { groupId: number } | undefined;
  if (!bill) throw new HttpError(404, "Không tìm thấy bill.");
  assertMember(bill.groupId, userId);
  db.prepare("DELETE FROM bills WHERE id = ?").run(billId);
}

export function listBills(groupId: number, from: string, to: string): Bill[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.id, b.group_id AS groupId, b.title, b.category, b.total,
              b.paid_by AS paidBy, u.name AS paidByName, b.spent_on AS spentOn,
              b.note, b.split_mode AS splitMode, b.source
         FROM bills b JOIN users u ON u.id = b.paid_by
        WHERE b.group_id = ? AND b.spent_on BETWEEN ? AND ?
        ORDER BY b.spent_on DESC, b.id DESC`
    )
    .all(groupId, from, to) as Omit<Bill, "shares">[];

  if (rows.length === 0) return [];

  const shareStmt = db.prepare(
    `SELECT s.bill_id AS billId, s.user_id AS userId, u.name, s.amount
       FROM bill_shares s JOIN users u ON u.id = s.user_id
      WHERE s.bill_id IN (${rows.map(() => "?").join(",")})`
  );
  const allShares = shareStmt.all(...rows.map((r) => r.id)) as (BillShare & {
    billId: number;
  })[];

  const byBill = new Map<number, BillShare[]>();
  for (const s of allShares) {
    const list = byBill.get(s.billId) ?? [];
    list.push({ userId: s.userId, name: s.name, amount: s.amount });
    byBill.set(s.billId, list);
  }

  return rows.map((r) => ({ ...r, shares: byBill.get(r.id) ?? [] }));
}

/**
 * Tổng chi của nhóm trong một khoảng ngày.
 *
 * Có hàm riêng thay vì gọi `listBills().reduce()` vì chart xu hướng cần tổng
 * của 6 kỳ liền nhau — kéo hết bill kèm bill_shares của cả 6 kỳ chỉ để cộng
 * lại là quá nặng.
 */
export function sumBills(groupId: number, from: string, to: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total FROM bills
        WHERE group_id = ? AND spent_on BETWEEN ? AND ?`
    )
    .get(groupId, from, to) as { total: number };
  return row.total;
}

/* ---------- Thanh toán ---------- */

export function listSettlements(groupId: number, from: string, to: string): Settlement[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.from_user_id AS fromUserId, f.name AS fromName,
              s.to_user_id AS toUserId, t.name AS toName,
              s.amount, s.paid_on AS paidOn, s.note
         FROM settlements s
         JOIN users f ON f.id = s.from_user_id
         JOIN users t ON t.id = s.to_user_id
        WHERE s.group_id = ? AND s.paid_on BETWEEN ? AND ?
        ORDER BY s.paid_on DESC, s.id DESC`
    )
    .all(groupId, from, to) as Settlement[];
}

export function createSettlement(args: {
  groupId: number;
  fromUserId: number;
  toUserId: number;
  amount: number;
  paidOn: string;
  note?: string;
}): number {
  if (args.fromUserId === args.toUserId)
    throw new HttpError(400, "Người trả và người nhận phải khác nhau.");
  if (args.amount <= 0) throw new HttpError(400, "Số tiền phải lớn hơn 0.");

  const memberIds = new Set(listMembers(args.groupId).map((m) => m.userId));
  if (!memberIds.has(args.fromUserId) || !memberIds.has(args.toUserId))
    throw new HttpError(400, "Người trả hoặc người nhận không thuộc nhóm.");

  const info = getDb()
    .prepare(
      `INSERT INTO settlements (group_id, from_user_id, to_user_id, amount, paid_on, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.groupId,
      args.fromUserId,
      args.toUserId,
      args.amount,
      args.paidOn,
      args.note ?? ""
    );
  return Number(info.lastInsertRowid);
}

export function deleteSettlement(id: number, userId: number): void {
  const db = getDb();
  const row = db
    .prepare("SELECT group_id AS groupId FROM settlements WHERE id = ?")
    .get(id) as { groupId: number } | undefined;
  if (!row) throw new HttpError(404, "Không tìm thấy khoản thanh toán.");
  assertMember(row.groupId, userId);
  db.prepare("DELETE FROM settlements WHERE id = ?").run(id);
}

/* ---------- Tài khoản ngân hàng (dùng cho lời nhắc nợ) ---------- */

export type BankAccountRow = {
  bankId: string;
  accountNumber: string;
  accountName: string;
};

export function getBankAccount(userId: number): BankAccountRow | null {
  const row = getDb()
    .prepare(
      `SELECT bank_id AS bankId, account_number AS accountNumber,
              account_name AS accountName
         FROM bank_accounts WHERE user_id = ?`
    )
    .get(userId) as BankAccountRow | undefined;
  return row ?? null;
}

/** Trả về Map<userId, BankAccountRow> cho nhiều người cùng lúc — tránh N truy vấn khi dựng danh sách nhắc nợ. */
export function getBankAccountsFor(userIds: number[]): Map<number, BankAccountRow> {
  const out = new Map<number, BankAccountRow>();
  if (userIds.length === 0) return out;
  const rows = getDb()
    .prepare(
      `SELECT user_id AS userId, bank_id AS bankId, account_number AS accountNumber,
              account_name AS accountName
         FROM bank_accounts WHERE user_id IN (${userIds.map(() => "?").join(",")})`
    )
    .all(...userIds) as (BankAccountRow & { userId: number })[];
  for (const r of rows) out.set(r.userId, r);
  return out;
}

export function upsertBankAccount(userId: number, input: BankAccountRow): void {
  const bankId = input.bankId.trim();
  const accountNumber = input.accountNumber.trim();
  const accountName = input.accountName.trim();
  if (!bankId) throw new HttpError(400, "Thiếu ngân hàng.");
  if (!accountNumber) throw new HttpError(400, "Thiếu số tài khoản.");
  if (!accountName) throw new HttpError(400, "Thiếu tên chủ tài khoản.");

  getDb()
    .prepare(
      `INSERT INTO bank_accounts (user_id, bank_id, account_number, account_name, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         bank_id = excluded.bank_id,
         account_number = excluded.account_number,
         account_name = excluded.account_name,
         updated_at = excluded.updated_at`
    )
    .run(userId, bankId, accountNumber, accountName);
}

export function deleteBankAccount(userId: number): void {
  getDb().prepare("DELETE FROM bank_accounts WHERE user_id = ?").run(userId);
}
