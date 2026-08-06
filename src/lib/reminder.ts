import { formatVnd } from "./money";
import type { Balance, Transfer } from "./types";
import type { Period } from "./period";

/** Tin nhắn nhắc cả nhóm, để dán vào Zalo/Telegram. */
export function groupReminderText(args: {
  groupName: string;
  period: Period;
  transfers: Transfer[];
  totalSpent: number;
}): string {
  const { groupName, period, transfers, totalSpent } = args;

  if (transfers.length === 0)
    return `${groupName} — ${period.label}\nCả nhóm đã cân bằng, không ai nợ ai. Tổng chi ${formatVnd(totalSpent)}.`;

  const lines = transfers
    .map((t) => `• ${t.fromName} chuyển ${t.toName}: ${formatVnd(t.amount)}`)
    .join("\n");

  return `${groupName} — chốt sổ ${period.label}
Tổng chi: ${formatVnd(totalSpent)}

Cần chuyển cho nhau:
${lines}

Chuyển xong nhớ vào app tick "Đã trả" giúp nhé.`;
}

/** Tin nhắn riêng cho một người đang nợ. */
export function personalReminderText(args: {
  groupName: string;
  period: Period;
  balance: Balance;
  transfers: Transfer[];
}): string {
  const { groupName, period, balance, transfers } = args;
  const mine = transfers.filter((t) => t.fromUserId === balance.userId);

  if (mine.length === 0)
    return `${balance.name} ơi, ${period.label} của ${groupName} bạn không còn nợ ai. Cảm ơn bạn.`;

  const lines = mine
    .map((t) => `• ${t.toName}: ${formatVnd(t.amount)}`)
    .join("\n");

  return `${balance.name} ơi, chốt sổ ${period.label} của ${groupName}:
bạn còn ${formatVnd(-balance.net)} cần chuyển.

${lines}

Chuyển xong nhắn lại giúp mình nhé, cảm ơn bạn.`;
}
