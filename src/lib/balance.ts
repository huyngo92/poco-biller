import type { Balance, Bill, Member, Settlement, Transfer } from "./types";

/**
 * Tính số dư ròng từng người (dùng cho trang Dashboard/Overview).
 * net > 0: ứng nhiều hơn phần mình, được nhận lại.
 * net < 0: còn phải trả.
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

  // Settlement: fromUserId = người trả, toUserId = người nhận.
  // Người trả coi như đã "ứng" thêm khoản này → nợ giảm về 0.
  // Người nhận đã lấy lại phần mình ứng → phần được nhận giảm tương ứng.
  for (const s of settlements) {
    bump(paid, s.fromUserId, s.amount);
    bump(paid, s.toUserId, -s.amount);
  }

  return members.map((m) => {
    const p = paid.get(m.userId) ?? 0;
    const o = owed.get(m.userId) ?? 0;
    return { userId: m.userId, name: m.name, avatar: m.avatar || "", paid: p, owed: o, net: p - o };
  });
}

/**
 * Tính danh sách chuyển tiền theo kiểu TRỰC TIẾP:
 * ai ứng bill thì nhận lại từ đúng người chia bill đó.
 *
 * Thuật toán:
 * 1. Với mỗi bill share: debt[share.userId][bill.paidBy] += share.amount
 *    (bỏ qua share của chính người ứng)
 * 2. Với mỗi settlement: debt[from][to] -= amount
 * 3. Triệt tiêu hai chiều: nếu A nợ B 100k và B nợ A 30k → A chỉ cần trả B 70k
 * 4. Trả về danh sách transfer, bỏ qua khoản < 1.000đ
 */
export function suggestTransfers(balances: Balance[], minAmount = 1000): Transfer[] {
  // balances không dùng trực tiếp ở đây, hàm này được gọi từ logic.ts
  // cùng bills/settlements — nên ta tính lại từ raw data qua overload bên dưới.
  // Giữ signature để không break caller, trả rỗng (logic.ts dùng suggestDirectTransfers).
  void balances; void minAmount;
  return [];
}

/**
 * Hàm thực tế được dùng bởi logic.ts — tính transfer trực tiếp từng cặp.
 */
export function suggestDirectTransfers(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[],
  minAmount = 1000
): Transfer[] {
  // debt[fromId][toId] = số tiền fromId nợ toId
  const debt = new Map<number, Map<number, number>>();

  const addDebt = (fromId: number, toId: number, amount: number) => {
    if (fromId === toId) return;
    if (!debt.has(fromId)) debt.set(fromId, new Map());
    const inner = debt.get(fromId)!;
    inner.set(toId, (inner.get(toId) ?? 0) + amount);
  };

  // Bước 1: mỗi share tạo nợ trực tiếp với người ứng
  for (const b of bills) {
    for (const s of b.shares) {
      if (s.userId !== b.paidBy) {
        addDebt(s.userId, b.paidBy, s.amount);
      }
    }
  }

  // Bước 2: settlements giảm nợ
  for (const s of settlements) {
    addDebt(s.fromUserId, s.toUserId, -s.amount);
  }

  // Bước 3: triệt tiêu hai chiều A↔B
  const memberMap = new Map(members.map((m) => [m.userId, m.name]));
  const out: Transfer[] = [];
  const visited = new Set<string>();

  for (const [fromId, inner] of debt) {
    for (const [toId] of inner) {
      const key = [fromId, toId].sort().join("-");
      if (visited.has(key)) continue;
      visited.add(key);

      const aOwesB = debt.get(fromId)?.get(toId) ?? 0;
      const bOwesA = debt.get(toId)?.get(fromId) ?? 0;
      const net = Math.round(aOwesB - bOwesA);

      if (net >= minAmount) {
        out.push({
          fromUserId: fromId,
          fromName: memberMap.get(fromId) ?? String(fromId),
          toUserId: toId,
          toName: memberMap.get(toId) ?? String(toId),
          amount: net,
        });
      } else if (net <= -minAmount) {
        out.push({
          fromUserId: toId,
          fromName: memberMap.get(toId) ?? String(toId),
          toUserId: fromId,
          toName: memberMap.get(fromId) ?? String(fromId),
          amount: -net,
        });
      }
    }
  }

  return out.sort((a, b) => b.amount - a.amount);
}
