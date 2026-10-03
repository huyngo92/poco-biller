import { getDb } from "./db";
import { listBills, listSettlements } from "./queries";
import { formatDateVn } from "./period";
import { categoryLabel } from "./types";

const ALL_FROM = "0000-01-01";
const ALL_TO = "9999-12-31";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  // BOM để Excel bản tiếng Việt đọc đúng dấu
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Sao kê gộp 1 file: khối bill (mỗi dòng là phần của một người trong một
 * bill — dễ pivot trong Excel) nối tiếp khối ghi nhận trả nợ, cách nhau một
 * dòng trống. Trước đây đây là hai file CSV riêng (exportGroupCsv /
 * exportSettlementsCsv) — gộp lại để người dùng chỉ cần tải một file.
 */
export function exportStatementCsv(groupId: number, from = ALL_FROM, to = ALL_TO): string {
  const bills = listBills(groupId, from, to);
  const settlements = listSettlements(groupId, from, to);

  const rows: (string | number)[][] = [["SAO KE BILL"]];
  rows.push([
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
  ]);
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

  rows.push([]);
  rows.push(["GHI NHAN TRA NO"]);
  rows.push(["settlement_id", "ngay_tra", "nguoi_tra", "nguoi_nhan", "so_tien", "ghi_chu"]);
  for (const s of settlements)
    rows.push([s.id, formatDateVn(s.paidOn), s.fromName, s.toName, s.amount, s.note]);

  return toCsv(rows);
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
