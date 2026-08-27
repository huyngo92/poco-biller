import { requireUser } from "@/lib/auth";
import { assertMember, createSettlement, listPushTokensForUser } from "@/lib/queries";
import { dateStr, fail, num, ok } from "@/lib/api";
import { sendPushToMany } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const groupId = num(body.groupId, "groupId");
    assertMember(groupId, user.id);

    const fromUserId = num(body.fromUserId, "người trả");
    const toUserId = num(body.toUserId, "người nhận");
    const amount = Math.round(num(body.amount, "số tiền"));
    const id = createSettlement({
      groupId,
      fromUserId,
      toUserId,
      amount,
      paidOn: dateStr(body.paidOn, "ngày trả"),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    });

    // Báo cho người nhận tiền khi người trả xác nhận đã thanh toán.
    if (fromUserId === user.id) {
      void sendPushToMany(listPushTokensForUser(toUserId), {
        title: "Đã ghi nhận thanh toán",
        body: `${user.name} đã xác nhận chuyển ${amount.toLocaleString("vi-VN")} ₫ cho bạn`,
        link: "/nhac-no",
      });
    }

    return ok({ settlementId: id }, 201);
  } catch (e) {
    return fail(e);
  }
}
