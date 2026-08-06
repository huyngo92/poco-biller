import { HttpError, requireUser } from "@/lib/auth";
import { assertMember, createBill } from "@/lib/queries";
import type { ShareInput } from "@/lib/queries";
import { dateStr, fail, num, ok, str } from "@/lib/api";
import type { SplitMode } from "@/lib/types";

const MODES: SplitMode[] = ["equal", "shares", "percent", "exact"];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const groupId = num(body.groupId, "groupId");
    assertMember(groupId, user.id);

    const total = Math.round(num(body.total, "tổng tiền"));
    if (total <= 0) throw new HttpError(400, "Tổng tiền phải lớn hơn 0.");

    const splitMode = MODES.includes(body.splitMode) ? body.splitMode : "equal";

    if (!Array.isArray(body.shares) || body.shares.length === 0)
      throw new HttpError(400, "Cần chọn ít nhất một người cùng chia.");

    const shares: ShareInput[] = body.shares.map((s: unknown) => {
      const o = s as Record<string, unknown>;
      return {
        userId: num(o.userId, "userId trong danh sách chia"),
        weight: o.weight === undefined ? undefined : Number(o.weight),
        amount: o.amount === undefined ? undefined : Math.round(Number(o.amount)),
      };
    });

    const billId = createBill(
      {
        groupId,
        title: str(body.title, "tên bill", 200),
        category: typeof body.category === "string" ? body.category : "khac",
        total,
        paidBy: num(body.paidBy, "người ứng tiền"),
        spentOn: dateStr(body.spentOn, "ngày chi"),
        note: typeof body.note === "string" ? body.note.slice(0, 1000) : "",
        splitMode,
        source: typeof body.source === "string" ? body.source : "manual",
        shares,
      },
      user.id
    );

    return ok({ billId }, 201);
  } catch (e) {
    return fail(e);
  }
}
