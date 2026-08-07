import type { Balance, Bill, Member, Settlement, Transfer } from "./types";

/**
 * Số dư ròng mỗi người trong một khoảng thời gian.
 * net > 0: đã ứng nhiều hơn phần của mình, được nhận lại.
 * net < 0: còn phải trả.
 * Các lần chuyển tiền đã ghi nhận (settlements) làm giảm nợ tương ứng.
 */
export function computeBalances(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[]
): Balance[] {
  const paid = new Map<number, number>();
  const owed = new Map<number, number>();
  for (const m of members) {
    paid.set(m.userId, 0);
    owed.set(m.userId, 0);
  }

  const bump = (map: Map<number, number>, id: number, delta: number) => {
    map.set(id, (map.get(id) ?? 0) + delta);
  };

  for (const b of bills) {
    bump(paid, b.paidBy, b.total);
    for (const s of b.shares) bump(owed, s.userId, s.amount);
  }

  // Settlement giảm nợ của người thanh toán, không phải tăng tiền ứng.
  for (const s of settlements) {
    bump(owed, s.fromUserId, s.amount);
  }

  return members.map((m) => {
    const p = paid.get(m.userId) ?? 0;
    const o = owed.get(m.userId) ?? 0;
    return { userId: m.userId, name: m.name, paid: p, owed: o, net: p - o };
  });
}

/**
 * Gợi ý danh sách chuyển tiền ít giao dịch nhất: luôn ghép người nợ nhiều nhất
 * với người được nhận nhiều nhất (greedy). Bỏ qua chênh lệch dưới 1.000 ₫.
 */
export function suggestTransfers(balances: Balance[], minAmount = 1000): Transfer[] {
  const debtors = balances
    .filter((b) => b.net < -0.5)
    .map((b) => ({ ...b, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((b) => b.net > 0.5)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  let guard = 0;

  while (i < debtors.length && j < creditors.length && guard++ < 1000) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.round(Math.min(d.remaining, c.remaining));

    if (amount >= minAmount) {
      out.push({
        fromUserId: d.userId,
        fromName: d.name,
        toUserId: c.userId,
        toName: c.name,
        amount,
      });
    }

    d.remaining -= amount;
    c.remaining -= amount;
    if (d.remaining < minAmount) i += 1;
    if (c.remaining < minAmount) j += 1;
  }

  return out.sort((a, b) => b.amount - a.amount);
}
