/**
 * Backup file DB hiện tại lên GitHub (branch backup-data) ngay lập tức.
 * Chạy: node scripts/backup-db.mjs
 *
 * Dùng SQLite backup API (không đọc thô .db) để lấy đúng dữ liệu đang nằm
 * trong file -wal — nếu không, các thay đổi chưa checkpoint sẽ bị bỏ sót.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

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
const token = process.env.GITHUB_BACKUP_TOKEN;
const repo = process.env.GITHUB_BACKUP_REPO;

function gh(apiPath, opts = {}) {
  return fetch(`https://api.github.com${apiPath}`, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
}

/** Snapshot DB qua SQLite backup API → Buffer. */
async function snapshot() {
  const db = new Database(dbPath, { readonly: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "poco-snap-"));
  const tmpPath = path.join(tmpDir, "snapshot.sqlite");
  try {
    await db.backup(tmpPath);
    const buffer = fs.readFileSync(tmpPath);
    const check = new Database(tmpPath, { readonly: true });
    try {
      const row = check
        .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='bills'")
        .get();
      if (row.n !== 1) throw new Error("Snapshot không có bảng bills — nghi file hỏng.");
    } finally {
      check.close();
    }
    return buffer;
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function ensureBranch() {
  const check = await gh(`/repos/${repo}/git/ref/heads/${BACKUP_BRANCH}`);
  if (check.ok) return;
  const info = await gh(`/repos/${repo}`);
  if (!info.ok) throw new Error(`Không truy cập được repo "${repo}" (${info.status}).`);
  const base = (await info.json()).default_branch || "main";
  const baseRef = await gh(`/repos/${repo}/git/ref/heads/${base}`);
  if (!baseRef.ok) throw new Error(`Không lấy được nhánh gốc "${base}" (${baseRef.status}).`);
  const sha = (await baseRef.json()).object.sha;
  const created = await gh(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${BACKUP_BRANCH}`, sha },
  });
  if (!created.ok && created.status !== 422)
    throw new Error(`Không tạo được nhánh backup (${created.status}).`);
}

async function upload(name, content) {
  const filePath = `backups/${name}`;
  const b64 = content.toString("base64");
  for (let attempt = 1; attempt <= 2; attempt++) {
    const existing = await gh(`/repos/${repo}/contents/${filePath}?ref=${BACKUP_BRANCH}`);
    const sha = existing.ok ? (await existing.json()).sha : undefined;
    const res = await gh(`/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      body: {
        message: `backup: ${name}`,
        content: b64,
        branch: BACKUP_BRANCH,
        ...(sha ? { sha } : {}),
      },
    });
    if (res.ok) return (await res.json()).content.path;
    if (res.status === 409 && attempt < 2) continue;
    throw new Error(`Upload thất bại (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

async function main() {
  if (!token || !repo) throw new Error("Thiếu GITHUB_BACKUP_TOKEN / GITHUB_BACKUP_REPO trong .env.");
  if (!fs.existsSync(dbPath)) throw new Error(`Không tìm thấy DB tại ${dbPath}.`);

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `poco-db-${stamp}.sqlite`;

  console.log(`[backup-db] Snapshot ${dbPath} ...`);
  const buffer = await snapshot();
  console.log(`[backup-db] Snapshot ${(buffer.length / 1024).toFixed(0)} KB → upload lên ${repo}@${BACKUP_BRANCH} ...`);

  await ensureBranch();
  const uploaded = await upload(fileName, buffer);
  console.log(`[backup-db] ✅ Đã sao lưu: ${uploaded} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error("[backup-db] Lỗi:", e.message);
  process.exit(1);
});
