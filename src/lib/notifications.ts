import { sendPushToMany } from "./push";
import { listPushTokensForUser, listPushTokensForGroup } from "./queries";

/**
 * Utility để gửi thông báo đẩy dựa trên các sự kiện nghiệp vụ.
 * Đảm bảo nội dung nhất quán và dễ dàng thay đổi.
 */

export async function notifyDebtReminder(debtorId: number, creditorName: string, amount: string, groupName: string) {
  const tokens = listPushTokensForUser(debtorId);
  if (tokens.length === 0) return;

  await sendPushToMany(tokens, {
    title: "Lời nhắc nợ mới 🔔",
    body: `${creditorName} vừa gửi lời nhắc nợ ${amount} trong nhóm ${groupName}.`,
    link: "/nhac-no",
  });
}

export async function notifyPaymentInitiated(creditorId: number, debtorName: string, amount: string) {
  const tokens = listPushTokensForUser(creditorId);
  if (tokens.length === 0) return;

  await sendPushToMany(tokens, {
    title: "Thông báo thanh toán 💸",
    body: `${debtorName} đã xác nhận chuyển khoản ${amount} cho bạn.`,
    link: "/nhac-no",
  });
}

export async function notifyPaymentConfirmed(debtorId: number, creditorName: string, amount: string) {
  const tokens = listPushTokensForUser(debtorId);
  if (tokens.length === 0) return;

  await sendPushToMany(tokens, {
    title: "Thanh toán thành công ✅",
    body: `${creditorName} đã xác nhận nhận được ${amount} từ bạn.`,
    link: "/nhac-no",
  });
}
