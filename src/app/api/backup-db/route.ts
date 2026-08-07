import { requireUser } from "@/lib/auth";
import { recentBackups } from "@/lib/backup";
import { githubBackupConfigured, findLatestGitHubBackup } from "@/lib/github-backup";
import { runDbBackup } from "@/lib/scheduler";
import { fail, ok } from "@/lib/api";

/** POST: Sao lưu toàn bộ file DB lên GitHub ngay, không chờ tới lịch. */
export async function POST() {
  try {
    await requireUser();
    if (!githubBackupConfigured()) return fail(new Error("Chưa cấu hình GitHub backup."));

    const res = await runDbBackup("db-full");
    return ok({ ...res, history: recentBackups(8) });
  } catch (e) {
    return fail(e);
  }
}

/** GET: Kiểm tra trạng thái + lịch sử backup. */
export async function GET() {
  try {
    await requireUser();
    const latest = githubBackupConfigured() ? await findLatestGitHubBackup("poco-db-") : null;
    return ok({
      configured: githubBackupConfigured(),
      latestBackup: latest,
      history: recentBackups(8),
    });
  } catch (e) {
    return fail(e);
  }
}
