import { requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { exportStatementCsv } from "@/lib/backup";
import { fail } from "@/lib/api";
import { resolvePeriod } from "@/lib/period";
import type { PeriodKind } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    assertMember(groupId, user.id);

    const url = new URL(req.url);
    // Một định dạng CSV gộp duy nhất (bill + ghi nhận trả nợ) — không còn JSON (không hỗ trợ import lại).
    const rawKind = (url.searchParams.get("period") ?? "all") as PeriodKind;
    const kind: PeriodKind = ["week", "month", "quarter", "all"].includes(rawKind)
      ? rawKind
      : "all";
    const period = resolvePeriod(kind, Number(url.searchParams.get("offset") ?? 0) || 0);
    const stamp = new Date().toISOString().slice(0, 10);

    const body = exportStatementCsv(groupId, period.from, period.to);
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="poco-sao-ke-${groupId}-${stamp}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
