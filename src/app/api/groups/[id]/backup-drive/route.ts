import { requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { exportGroupCsv, logBackup, recentBackups } from "@/lib/backup";
import { driveConfigured, uploadToDrive } from "@/lib/drive";
import { fail, ok } from "@/lib/api";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    assertMember(groupId, user.id);
    return ok({ configured: driveConfigured(), history: recentBackups(8) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(_req: Request, { params }: Ctx) {
  const groupId = Number((await params).id);
  try {
    const user = await requireUser();
    assertMember(groupId, user.id);

    const name = (
      getDb().prepare("SELECT name FROM groups WHERE id = ?").get(groupId) as
        | { name: string }
        | undefined
    )?.name;

    const stamp = new Date().toISOString().slice(0, 10);
    const file = await uploadToDrive({
      name: `poco-bills-${groupId}-${stamp}.csv`,
      mimeType: "text/csv",
      content: exportGroupCsv(groupId),
    });

    logBackup("csv", "google-drive", "ok", `${file.name} (nhóm ${name ?? groupId})`);
    return ok({ file, history: recentBackups(8) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định";
    try {
      logBackup("csv", "google-drive", "loi", message);
    } catch {
      // Không để lỗi ghi log che mất lỗi gốc
    }
    return fail(e);
  }
}
