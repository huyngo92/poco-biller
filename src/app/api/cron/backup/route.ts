import { getDb } from "@/lib/db";
import { exportGroupCsv, logBackup } from "@/lib/backup";
import { driveConfigured, uploadToDrive } from "@/lib/drive";
import { ok } from "@/lib/api";
import { NextResponse } from "next/server";

/**
 * Backup CSV toàn bộ nhóm lên Google Drive.
 * Gọi hàng ngày bằng cron ngoài hệ thống:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://host/api/cron/backup
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

  if (!driveConfigured())
    return NextResponse.json(
      { error: "Chưa cấu hình Google Drive." },
      { status: 503 }
    );

  const groups = getDb()
    .prepare("SELECT id, name FROM groups ORDER BY id")
    .all() as { id: number; name: string }[];

  const stamp = new Date().toISOString().slice(0, 10);
  const results: { groupId: number; status: string; detail: string }[] = [];

  for (const g of groups) {
    try {
      const file = await uploadToDrive({
        name: `poco-bills-${g.id}-${stamp}.csv`,
        mimeType: "text/csv",
        content: exportGroupCsv(g.id),
      });
      logBackup("csv-cron", "google-drive", "ok", `${file.name} (${g.name})`);
      results.push({ groupId: g.id, status: "ok", detail: file.name });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lỗi không xác định";
      logBackup("csv-cron", "google-drive", "loi", `${g.name}: ${message}`);
      results.push({ groupId: g.id, status: "loi", detail: message });
    }
  }

  return ok({ ranAt: new Date().toISOString(), results });
}
