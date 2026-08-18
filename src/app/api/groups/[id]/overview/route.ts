import { requireUser } from "@/lib/auth";
import {
  assertMember,
  listBills,
  listMembers,
  listSettlements,
  sumBills,
} from "@/lib/queries";
import { computeBalances, suggestDirectTransfers } from "@/lib/balance";
import { recentPeriods, resolvePeriod, shortPeriodLabel } from "@/lib/period";
import { fail, ok } from "@/lib/api";
import type { PeriodKind } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const KINDS: PeriodKind[] = ["week", "month", "quarter", "all"];

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    const role = assertMember(groupId, user.id);

    const url = new URL(req.url);
    const rawKind = url.searchParams.get("period") ?? "month";
    const kind: PeriodKind = KINDS.includes(rawKind as PeriodKind)
      ? (rawKind as PeriodKind)
      : "month";
    const offset = Number(url.searchParams.get("offset") ?? 0) || 0;

    const period = resolvePeriod(kind, offset);
    const members = listMembers(groupId);
    const bills = listBills(groupId, period.from, period.to);
    const settlements = listSettlements(groupId, period.from, period.to);
    const balances = computeBalances(members, bills, settlements);

    const spentByCategory = new Map<string, number>();
    for (const b of bills)
      spentByCategory.set(b.category, (spentByCategory.get(b.category) ?? 0) + b.total);

    // Xu hướng 6 kỳ gần nhất, kỳ cuối chính là kỳ đang xem
    const trend = recentPeriods(kind, offset, 6).map((p) => ({
      label: shortPeriodLabel(p),
      from: p.from,
      amount: sumBills(groupId, p.from, p.to),
    }));

    return ok({
      period,
      trend,
      role,
      members,
      bills,
      settlements,
      balances,
      transfers: suggestDirectTransfers(members, bills, settlements),
      totals: {
        spent: bills.reduce((a, b) => a + b.total, 0),
        billCount: bills.length,
        byCategory: [...spentByCategory.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
