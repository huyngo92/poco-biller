import { getDb } from "./db";
import { HttpError } from "./auth";
import { listBills, listMembers, listSettlements } from "./queries";
import { formatDateVn } from "./period";
import { categoryLabel } from "./types";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  group: { id: number; name: string; inviteCode: string };
  members: { userId: number; name: string; email: string; role: string }[];
  bills: unknown[];
  settlements: unknown[];
};

const ALL_FROM = "0000-01-01";
const ALL_TO = "9999-12-31";

export function exportGroupJson(groupId: number): BackupPayload {
  const db = getDb();
  const group = db
    .prepare("SELECT id, name, invite_code AS inviteCode FROM groups WHERE id = ?")
    .get(groupId) as { id: number; name: string; inviteCode: string } | undefined;
  if (!group) throw new HttpError(404, "Không tìm thấy nhóm.");

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    group,
    members: listMembers(groupId),
    bills: listBills(groupId, ALL_FROM, ALL_TO),
    settlements: listSettlements(groupId, ALL_FROM, ALL_TO),
  };
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  // BOM để Excel bản tiếng Việt đọc đúng dấu
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Mỗi dòng là phần của một người trong một bill — dễ pivot trong Excel. */
export function exportGroupCsv(groupId: number, from = ALL_FROM, to = ALL_TO): string {
  const bills = listBills(groupId, from, to);
  const rows: (string | number)[][] = [
    [
      "bill_id",
      "ngay",
      "ten_bill",
      "nhom_chi_phi",
      "tong_tien",
      "nguoi_ung_tien",
      "cach_chia",
      "thanh_vien",
      "phan_phai_tra",
      "ghi_chu",
    ],
  ];

  for (const b of bills)
    for (const s of b.shares)
      rows.push([
        b.id,
        formatDateVn(b.spentOn),
        b.title,
        categoryLabel(b.category),
        b.total,
        b.paidByName,
        b.splitMode,
        s.name,
        s.amount,
        b.note,
      ]);

  return toCsv(rows);
}

export function exportSettlementsCsv(groupId: number, from = ALL_FROM, to = ALL_TO): string {
  const rows: (string | number)[][] = [
    ["settlement_id", "ngay_tra", "nguoi_tra", "nguoi_nhan", "so_tien", "ghi_chu"],
  ];
  for (const s of listSettlements(groupId, from, to))
    rows.push([s.id, formatDateVn(s.paidOn), s.fromName, s.toName, s.amount, s.note]);
  return toCsv(rows);
}

/**
 * Nhập lại dữ liệu từ file JSON đã export vào một nhóm đang có.
 * Ghép thành viên theo email; ai chưa có trong nhóm thì bỏ qua phần của họ.
 * Bill trùng (cùng ngày, tên, tổng tiền) sẽ được bỏ qua để nhập lại nhiều lần vẫn an toàn.
 */
export function importIntoGroup(
  groupId: number,
  payload: BackupPayload,
  importedBy: number
): { billsAdded: number; billsSkipped: number; settlementsAdded: number } {
  const db = getDb();
  if (payload?.version !== 1)
    throw new HttpError(400, "File backup không đúng định dạng của Poco Biller.");

  const emailToId = new Map<string, number>();
  for (const m of listMembers(groupId)) emailToId.set(m.email.toLowerCase(), m.userId);

  const sourceIdToEmail = new Map<number, string>();
  for (const m of payload.members ?? [])
    sourceIdToEmail.set(m.userId, (m.email ?? "").toLowerCase());

  const mapUser = (sourceId: number): number | null => {
    const email = sourceIdToEmail.get(sourceId);
    if (!email) return null;
    return emailToId.get(email) ?? null;
  };

  let billsAdded = 0;
  let billsSkipped = 0;
  let settlementsAdded = 0;

  db.transaction(() => {
    for (const raw of payload.bills ?? []) {
      const b = raw as {
        title: string;
        category: string;
        total: number;
        paidBy: number;
        spentOn: string;
        note?: string;
        splitMode: string;
        shares: { userId: number; amount: number }[];
      };

      const paidBy = mapUser(b.paidBy);
      if (!paidBy) {
        billsSkipped += 1;
        continue;
      }

      const shares = (b.shares ?? [])
        .map((s) => ({ userId: mapUser(s.userId), amount: Math.round(s.amount) }))
        .filter((s): s is { userId: number; amount: number } => s.userId !== null);

      const sum = shares.reduce((a, s) => a + s.amount, 0);
      if (shares.length === 0 || sum !== Math.round(b.total)) {
        billsSkipped += 1;
        continue;
      }

      const dupe = db
        .prepare(
          "SELECT 1 FROM bills WHERE group_id = ? AND spent_on = ? AND title = ? AND total = ?"
        )
        .get(groupId, b.spentOn, b.title, Math.round(b.total));
      if (dupe) {
        billsSkipped += 1;
        continue;
      }

      const info = db
        .prepare(
          `INSERT INTO bills
             (group_id, title, category, total, paid_by, spent_on, note, split_mode, source, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)`
        )
        .run(
          groupId,
          b.title,
          b.category ?? "khac",
          Math.round(b.total),
          paidBy,
          b.spentOn,
          b.note ?? "",
          b.splitMode ?? "exact",
          importedBy
        );

      const billId = Number(info.lastInsertRowid);
      const stmt = db.prepare(
        "INSERT INTO bill_shares (bill_id, user_id, amount) VALUES (?, ?, ?)"
      );
      for (const s of shares) stmt.run(billId, s.userId, s.amount);
      billsAdded += 1;
    }

    for (const raw of payload.settlements ?? []) {
      const s = raw as {
        fromUserId: number;
        toUserId: number;
        amount: number;
        paidOn: string;
        note?: string;
      };
      const from = mapUser(s.fromUserId);
      const to = mapUser(s.toUserId);
      if (!from || !to || from === to) continue;

      const dupe = db
        .prepare(
          `SELECT 1 FROM settlements
            WHERE group_id = ? AND from_user_id = ? AND to_user_id = ? AND amount = ? AND paid_on = ?`
        )
        .get(groupId, from, to, Math.round(s.amount), s.paidOn);
      if (dupe) continue;

      db.prepare(
        `INSERT INTO settlements (group_id, from_user_id, to_user_id, amount, paid_on, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(groupId, from, to, Math.round(s.amount), s.paidOn, s.note ?? "");
      settlementsAdded += 1;
    }
  })();

  return { billsAdded, billsSkipped, settlementsAdded };
}

export function logBackup(kind: string, target: string, status: string, detail = "") {
  getDb()
    .prepare("INSERT INTO backup_log (kind, target, status, detail) VALUES (?, ?, ?, ?)")
    .run(kind, target, status, detail.slice(0, 1000));
}

export function recentBackups(limit = 10) {
  return getDb()
    .prepare(
      "SELECT id, kind, target, status, detail, created_at AS createdAt FROM backup_log ORDER BY id DESC LIMIT ?"
    )
    .all(limit) as {
    id: number;
    kind: string;
    target: string;
    status: string;
    detail: string;
    createdAt: string;
  }[];
}
