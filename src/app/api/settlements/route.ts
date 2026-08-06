import { requireUser } from "@/lib/auth";
import { assertMember, createSettlement } from "@/lib/queries";
import { dateStr, fail, num, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const groupId = num(body.groupId, "groupId");
    assertMember(groupId, user.id);

    const id = createSettlement({
      groupId,
      fromUserId: num(body.fromUserId, "người trả"),
      toUserId: num(body.toUserId, "người nhận"),
      amount: Math.round(num(body.amount, "số tiền")),
      paidOn: dateStr(body.paidOn, "ngày trả"),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    });

    return ok({ settlementId: id }, 201);
  } catch (e) {
    return fail(e);
  }
}
