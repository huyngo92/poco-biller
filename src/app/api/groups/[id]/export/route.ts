import { requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { exportGroupCsv, exportSettlementsCsv } from "@/lib/backup";
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
    // Chỉ còn hai định dạng CSV để tải — không còn JSON (không hỗ trợ import lại).
    const format = url.searchParams.get("format") ?? "csv";
    const rawKind = (url.searchParams.get("period") ?? "all") as PeriodKind;
    const kind: PeriodKind = ["week", "month", "quarter", "all"].includes(rawKind)
      ? rawKind
      : "all";
    const period = resolvePeriod(kind, Number(url.searchParams.get("offset") ?? 0) || 0);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv-settlements") {
      const body = exportSettlementsCsv(groupId, period.from, period.to);
      return new Response(body, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="poco-thanh-toan-${groupId}-${stamp}.csv"`,
        },
      });
    }

    const body = exportGroupCsv(groupId, period.from, period.to);
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="poco-bills-${groupId}-${stamp}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
