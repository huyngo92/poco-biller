import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let instance: Database.Database | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT, -- NULL cho người dùng đăng nhập qua SSO
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS bills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'khac',
  total      INTEGER NOT NULL,
  paid_by    INTEGER NOT NULL REFERENCES users(id),
  spent_on   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  split_mode TEXT NOT NULL DEFAULT 'equal',
  source     TEXT NOT NULL DEFAULT 'manual',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bills_group_date ON bills(group_id, spent_on);

CREATE TABLE IF NOT EXISTS bill_shares (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount  INTEGER NOT NULL,
  UNIQUE (bill_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_bill ON bill_shares(bill_id);

CREATE TABLE IF NOT EXISTS settlements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id   INTEGER NOT NULL REFERENCES users(id),
  amount       INTEGER NOT NULL,
  paid_on      TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_settle_group ON settlements(group_id, paid_on);

CREATE TABLE IF NOT EXISTS backup_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  target     TEXT NOT NULL,
  status     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/** Số tài khoản ngân hàng riêng của mỗi người, dùng để in vào lời nhắc nợ. */
CREATE TABLE IF NOT EXISTS bank_accounts (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_id        TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function dbFilePath(): string {
  return path.resolve(process.env.DATABASE_PATH || "./data/poco.db");
}

export function getDb(): Database.Database {
  if (instance) return instance;

  const dbPath = dbFilePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.exec(SCHEMA);
  instance = db;

  // Bật scheduler backup ở đây thay vì trong instrumentation.ts.
  //
  // Cách "đúng sách" là dùng hook register() của instrumentation, nhưng Next
  // biên dịch file đó cho cả edge runtime và webpack trace CẢ import động, nên
  // mọi đường dẫn tới file này đều kéo better-sqlite3 vào bundle edge và vỡ với
  // "Module not found: Can't resolve 'fs'". Đã thử guard NEXT_RUNTIME lẫn
  // await import() — cả hai đều không chặn được vì chúng chỉ tác động lúc chạy.
  //
  // getDb() là điểm vào duy nhất của DB và chỉ tồn tại ở Node runtime, nên gắn
  // vào đây là chắc chắn. Đánh đổi: scheduler khởi động ở request đầu tiên có
  // đụng DB thay vì ngay lúc boot — không ảnh hưởng gì vì lịch tính theo đồng
  // hồ thực, và trang nào cũng đụng DB.
  void import("./scheduler")
    .then((m) => m.startBackupScheduler())
    .catch((e) => console.error("[poco-biller] Không bật được scheduler:", e));

  return db;
}

/**
 * Trả về bytes của một bản sao DB nhất quán, gồm cả dữ liệu còn nằm trong WAL.
 *
 * Không đọc thô file .db: ở chế độ WAL, dữ liệu mới nằm trong file -wal cho tới
 * khi checkpoint, và `wal_checkpoint(TRUNCATE)` sẽ âm thầm bỏ qua (trả busy=1)
 * nếu có kết nối khác đang đọc — đọc thô lúc đó ra file gần như rỗng. Đã gặp
 * đúng lỗi này: backup lên GitHub chỉ 4KB trong khi WAL giữ 144KB dữ liệu thật.
 *
 * SQLite backup API xử lý đúng mọi trường hợp đó.
 */
export async function snapshotDb(): Promise<Buffer> {
  const db = getDb();
  const tmpPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "poco-snap-")),
    "snapshot.sqlite"
  );

  try {
    await db.backup(tmpPath);
    const buffer = fs.readFileSync(tmpPath);

    // Bản snapshot phải mở ra đọc được và có bảng bills — chặn trường hợp
    // đẩy lên GitHub một file rỗng/hỏng mà không ai biết.
    const check = new Database(tmpPath, { readonly: true });
    try {
      const row = check
        .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'bills'")
        .get() as { n: number };
      if (row.n !== 1)
        throw new Error("Bản snapshot DB không có bảng bills — nghi file rỗng hoặc hỏng.");
    } finally {
      check.close();
    }

    return buffer;
  } finally {
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
  }
}
