/**
 * Restore DB từ GitHub repo khi deploy nếu file DB local chưa tồn tại.
 * Chạy: node scripts/restore-db.mjs
 */
import fs from "node:fs";
import path from "node:path";

// Load .env
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
} catch { /* ignore */ }

const BACKUP_BRANCH = "backup-data";
const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/poco.db");

async function main() {
  if (fs.existsSync(dbPath)) {
    console.log(`[restore-db] DB đã tồn tại tại ${dbPath} — bỏ qua restore.`);
    return;
  }

  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!token || !repo) {
    console.log("[restore-db] Chưa cấu hình GITHUB_BACKUP_TOKEN / GITHUB_BACKUP_REPO — bỏ qua.");
    return;
  }

  console.log("[restore-db] DB chưa có, đang tìm backup trên GitHub...");

  // List backups/ directory
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/backups?ref=${BACKUP_BRANCH}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
    }
  );

  if (!listRes.ok) {
    console.log(`[restore-db] Không đọc được branch ${BACKUP_BRANCH} (${listRes.status}). Bỏ qua.`);
    return;
  }

  const files = await listRes.json();
  const dbFiles = files
    .filter((f) => f.name.startsWith("poco-db-"))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (dbFiles.length === 0) {
    console.log("[restore-db] Không tìm thấy backup DB nào trên GitHub.");
    return;
  }

  const latest = dbFiles[0];
  console.log(`[restore-db] Tìm thấy: ${latest.name} — đang tải về...`);

  // Contents API chỉ nhúng base64 cho file dưới 1MB; file lớn hơn trả content
  // rỗng. Dùng Git Blob API với accept=raw để lấy đúng bytes ở mọi kích cỡ
  // (blob API đọc được tới 100MB), không phụ thuộc download_url có hạn giờ.
  const fileRes = await fetch(
    `https://api.github.com/repos/${repo}/git/blobs/${latest.sha}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github.raw",
      },
    }
  );

  if (!fileRes.ok) {
    throw new Error(`Download failed: ${fileRes.status}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.length === 0) throw new Error("Backup tải về rỗng (0 byte).");

  // SQLite hợp lệ luôn mở đầu bằng chuỗi "SQLite format 3\0"
  const magic = buffer.subarray(0, 15).toString("latin1");
  if (magic !== "SQLite format 3")
    throw new Error(
      `File tải về không phải SQLite (mở đầu: ${JSON.stringify(magic)}). Có thể GitHub trả về JSON lỗi thay vì nội dung file.`
    );

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, buffer);

  console.log(`[restore-db] Đã restore ${latest.name} (${(buffer.length / 1024).toFixed(0)} KB) → ${dbPath}`);
}

main().catch((e) => {
  console.error("[restore-db] Lỗi:", e.message);
  process.exit(1);
});
