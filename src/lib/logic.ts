import { getDb } from "./db";
import { computeBalances, suggestDirectTransfers } from "./balance";
import { getBankAccountsFor } from "./queries";
import { findBank } from "./banks";
import { resolvePeriod } from "./period";
import type { Bank } from "./banks";
import type { Bill, Settlement } from "./types";

/** Tài khoản ngân hàng của một người, đã ghép sẵn thông tin ngân hàng để hiển thị/sinh QR. */
export type ReminderBankAccount = {
  bank: Bank | null;
  accountNumber: string;
  accountName: string;
};

export type Reminder = {
  groupId: number;
  debtor: { id: number; name: string };
  creditor: {
    user: { id: number; name: string };
    bankAccount: ReminderBankAccount | null;
  };
  amount: number;
};

/**
 * Ai còn nợ ai trong một nhóm, tính trên toàn bộ lịch sử (chưa chốt theo kỳ),
 * kèm thông tin tài khoản ngân hàng của người được nhận nếu họ đã khai báo —
 * để trang "Nhắc nợ" in kèm số tài khoản/QR vào lời nhắc.
 */
export function getReminders(groupId: number): Reminder[] {
  const db = getDb();

  const members = db
    .prepare(
      `SELECT u.id AS userId, u.name, u.email, m.role, u.avatar
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.group_id = ?`
    )
    .all(groupId) as { userId: number; name: string; email: string; role: "admin" | "member"; avatar: string }[];

  if (members.length === 0) return [];

  const period = resolvePeriod("all");

  const bills = db
    .prepare(
      `SELECT b.id, b.paid_by AS paidBy, b.total
         FROM bills b WHERE b.group_id = ? AND b.spent_on BETWEEN ? AND ?`
    )
    .all(groupId, period.from, period.to) as { id: number; paidBy: number; total: number }[];

  const shareRows =
    bills.length === 0
      ? []
      : (db
          .prepare(
            `SELECT bs.bill_id AS billId, bs.user_id AS userId, bs.amount, u.name
               FROM bill_shares bs JOIN users u ON u.id = bs.user_id
              WHERE bs.bill_id IN (${bills.map(() => "?").join(",")})`
          )
          .all(...bills.map((b) => b.id)) as { billId: number; userId: number; amount: number; name: string }[]);

  // Thêm những người có trong bill_shares nhưng chưa join nhóm (e.g. khách mời)
  const memberIds = new Set(members.map((m) => m.userId));
  for (const s of shareRows) {
    if (!memberIds.has(s.userId)) {
      members.push({ userId: s.userId, name: s.name, email: "", role: "member", avatar: "" });
      memberIds.add(s.userId);
    }
  }

  const sharesByBill = new Map<number, { userId: number; amount: number }[]>();
  for (const s of shareRows) {
    const list = sharesByBill.get(s.billId) ?? [];
    list.push({ userId: s.userId, amount: s.amount });
    sharesByBill.set(s.billId, list);
  }

  const settlements = db
    .prepare(
      `SELECT from_user_id AS fromUserId, to_user_id AS toUserId, amount
         FROM settlements WHERE group_id = ? AND paid_on BETWEEN ? AND ?`
    )
    .all(groupId, period.from, period.to) as {
    fromUserId: number;
    toUserId: number;
    amount: number;
  }[];

  const transfers = suggestDirectTransfers(
    members,
    bills.map((b) => ({
      paidBy: b.paidBy,
      total: b.total,
      shares: sharesByBill.get(b.id) ?? [],
    })) as unknown as Bill[],
    settlements as unknown as Settlement[]
  );
  if (transfers.length === 0) return [];

  const bankAccounts = getBankAccountsFor(transfers.map((t) => t.toUserId));

  return transfers.map((t) => {
    const account = bankAccounts.get(t.toUserId);
    return {
      groupId,
      debtor: { id: t.fromUserId, name: t.fromName },
      creditor: {
        user: { id: t.toUserId, name: t.toName },
        bankAccount: account
          ? {
              bank: findBank(account.bankId) ?? null,
              accountNumber: account.accountNumber,
              accountName: account.accountName,
            }
          : null,
      },
      amount: t.amount,
    };
  });
}
