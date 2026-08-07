import { cronMatches, describeCron, parseCron } from "./cron-expr";

/**
 * Hẹn giờ backup DB ngay trong tiến trình app, lịch khai bằng BACKUP_CRON
 * trong .env — không cần crontab của máy.
 *
 * Endpoint /api/cron/backup vẫn giữ để gọi tay hoặc cho Vercel Cron (serverless
 * không giữ tiến trình sống nên scheduler nội bộ vô dụng ở đó).
 *
 * QUAN TRỌNG — ./db, ./backup, ./github-backup phải import ĐỘNG bên trong hàm,
 * không được import ở đầu file: db.ts gọi startBackupScheduler() nên import tĩnh
 * sẽ tạo vòng lặp module db ⇄ scheduler, và ở ESM thì vòng lặp kiểu này cho ra
 * binding chưa khởi tạo (snapshotDb là undefined) chỉ khi chạy tới, rất khó lần.
 * Import động phá vòng vì nó chỉ giải quyết lúc gọi hàm.
 */

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
/** Chặn chạy trùng: một phút chỉ backup một lần dù tick có gọi lại. */
let lastRunMinute = "";
let running = false;

export type BackupRunResult = { file: string; sizeKB: number };

/** Chụp DB và đẩy lên GitHub. Dùng chung cho scheduler và endpoint gọi tay. */
export async function runDbBackup(kind: string): Promise<BackupRunResult> {
  const [{ snapshotDb }, { logBackup }, { uploadToGitHub }] = await Promise.all([
    import("./db"),
    import("./backup"),
    import("./github-backup"),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `poco-db-${stamp}.sqlite`;

  try {
    const buffer = await snapshotDb();
    await uploadToGitHub({ name: fileName, content: buffer });
    const sizeKB = Math.round(buffer.length / 1024);
    logBackup(kind, "github", "ok", `${fileName} (${sizeKB} KB)`);
    return { file: fileName, sizeKB };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định";
    logBackup(kind, "github", "loi", message);
    throw e;
  }
}

export function startBackupScheduler(): void {
  if (started) return;
  started = true;

  const expr = process.env.BACKUP_CRON?.trim();
  if (!expr) return; // Không khai lịch = tắt, im lặng là đúng.

  // Kiểm tra thẳng env thay vì gọi githubBackupConfigured() từ ./github-backup:
  // module đó import ./auth, kéo thêm graph không cần thiết vào bundle mà ở đây
  // chỉ cần biết hai biến này có hay không.
  if (!process.env.GITHUB_BACKUP_TOKEN || !process.env.GITHUB_BACKUP_REPO) {
    console.warn(
      "[poco-biller] BACKUP_CRON đã đặt nhưng chưa cấu hình GITHUB_BACKUP_TOKEN/GITHUB_BACKUP_REPO — bỏ qua scheduler."
    );
    return;
  }

  let fields;
  try {
    fields = parseCron(expr);
  } catch (e) {
    // Không im lặng bỏ qua: lịch sai mà app vẫn chạy bình thường thì tới hôm
    // cần khôi phục mới phát hiện chẳng có bản backup nào.
    console.error(
      `[poco-biller] BACKUP_CRON không hợp lệ nên backup tự động KHÔNG chạy: ${
        e instanceof Error ? e.message : e
      }`
    );
    return;
  }

  console.log(`[poco-biller] Backup DB tự động: ${describeCron(expr)}.`);

  // Kiểm mỗi 30 giây: đủ dày để không bỏ sót phút nào kể cả khi event loop bị
  // nghẽn, và đã có lastRunMinute chặn chạy trùng.
  timer = setInterval(() => {
    void tick(fields);
  }, 30_000);

  // Để tiến trình vẫn thoát được bình thường khi nhận SIGINT.
  timer.unref?.();
}

async function tick(fields: ReturnType<typeof parseCron>): Promise<void> {
  const now = new Date();
  if (!cronMatches(fields, now)) return;

  const key = `${now.toDateString()} ${now.getHours()}:${now.getMinutes()}`;
  if (key === lastRunMinute || running) return;
  lastRunMinute = key;

  running = true;
  try {
    const res = await runDbBackup("db-auto");
    console.log(`[poco-biller] Đã backup ${res.file} (${res.sizeKB} KB) lên GitHub.`);
  } catch (e) {
    console.error(
      `[poco-biller] Backup tự động thất bại: ${e instanceof Error ? e.message : e}`
    );
  } finally {
    running = false;
  }
}

export function stopBackupScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
