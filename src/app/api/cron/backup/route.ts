import { githubBackupConfigured } from "@/lib/github-backup";
import { runDbBackup } from "@/lib/scheduler";
import { ok } from "@/lib/api";
import { NextResponse } from "next/server";

/**
 * Sao lưu toàn bộ file DB lên GitHub. Chỉ DB — không backup CSV, vì CSV chỉ để
 * người dùng tải về xem, còn khôi phục sau khi build lại thì cần đúng file .db.
 *
 * Bình thường app tự hẹn giờ theo BACKUP_CRON trong .env, không cần gọi vào đây.
 * Endpoint này để gọi tay khi muốn backup ngay, hoặc cho môi trường serverless
 * (Vercel Cron) nơi tiến trình không sống lâu để tự hẹn giờ:
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/backup
 *
 * CRON_SECRET là mật khẩu bảo vệ endpoint (không phải lịch chạy) — để trống thì
 * endpoint tự tắt.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Chưa đặt CRON_SECRET nên endpoint này đang tắt." },
      { status: 503 }
    );

  const provided =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret") ??
    "";
  if (provided !== secret)
    return NextResponse.json({ error: "Sai mã bảo vệ." }, { status: 401 });

  if (!githubBackupConfigured())
    return NextResponse.json(
      { error: "Chưa cấu hình GitHub backup." },
      { status: 503 }
    );

  try {
    const res = await runDbBackup("db-cron");
    return ok({ ranAt: new Date().toISOString(), ...res });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định";
    console.error("[poco-biller] cron backup:", message);
    return NextResponse.json(
      { error: message, ranAt: new Date().toISOString() },
      { status: 502 }
    );
  }
}
