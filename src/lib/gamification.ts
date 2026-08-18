/**
 * Gamification cộng tác cho Poco Biller — THUẦN HÀM, suy hoàn toàn từ dữ liệu
 * đã có (members, bills, bill_shares, settlements) nên test được qua
 * scripts/test-logic.mjs và không cần đổi schema DB.
 *
 * Triết lý (theo gamification_for_poco_biller.md): cộng tác thay vì cạnh tranh,
 * tôn trọng ngữ cảnh tiền bạc, minh bạch (mỗi trạng thái giải thích được).
 */

import type { Bill, Member, Settlement } from "./types";
import { suggestDirectTransfers } from "./balance";

// ---------------------------------------------------------------------------
// Tiện ích nội bộ
// ---------------------------------------------------------------------------

/** Bill "đủ thông tin": có tiêu đề, tổng > 0, người ứng và ngày chi. */
function isFilledBill(b: Bill): boolean {
  return (
    !!b.title && b.title.trim().length > 0 &&
    b.total > 0 &&
    !!b.paidBy &&
    !!b.spentOn && b.spentOn.trim().length > 0
  );
}

/** Bill "rõ ràng": đủ thông tin + có gán hạng mục. */
function isClearBill(b: Bill): boolean {
  return isFilledBill(b) && !!b.category && b.category.trim().length > 0;
}

/** Bill đã chia xong: có shares và tổng shares khớp total (cho phép sai số làm tròn). */
function isSplitBill(b: Bill): boolean {
  if (!b.shares || b.shares.length === 0) return false;
  const sum = b.shares.reduce((acc, s) => acc + s.amount, 0);
  const tolerance = Math.max(1, b.shares.length); // mỗi người lệch tối đa 1đ do làm tròn
  return Math.abs(sum - b.total) <= tolerance;
}

/** Tập userId đã xuất hiện trong ít nhất một bill share. */
function participantIds(bills: Bill[]): Set<number> {
  const ids = new Set<number>();
  for (const b of bills) for (const s of b.shares) ids.add(s.userId);
  return ids;
}

/** Mọi thành viên đều đã có mặt trong ≥1 share (xấp xỉ "ai cũng đã kiểm tra phần mình"). */
function everyoneParticipates(members: Member[], bills: Bill[]): boolean {
  if (members.length === 0 || bills.length === 0) return false;
  const ids = participantIds(bills);
  return members.every((m) => ids.has(m.userId));
}

/** Số khoản chuyển tiền còn lại (nợ chưa xử lý). */
function remainingTransferCount(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[]
): number {
  return suggestDirectTransfers(members, bills, settlements).length;
}

// ---------------------------------------------------------------------------
// 3.1 Tiến độ nhóm (4 bước)
// ---------------------------------------------------------------------------

export type ProgressStepKey = "created" | "confirmed" | "split" | "done";

export type ProgressStep = {
  key: ProgressStepKey;
  label: string;
  done: boolean;
  hint: string;
};

export type GroupProgress = {
  steps: ProgressStep[];
  doneCount: number;
  total: number;
  complete: boolean;
};

/**
 * 4 bước: Đã tạo bill → Đã xác nhận → Đã chia tiền → Đã hoàn tất.
 * (Bước "Đã xác nhận" là xấp xỉ: mọi thành viên đã có mặt trong ≥1 share,
 *  vì data model hiện chưa có bảng xác nhận từng người.)
 */
export function groupProgress(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[]
): GroupProgress {
  const hasBill = bills.some(isFilledBill);
  const confirmed = everyoneParticipates(members, bills);
  const allSplit = bills.length > 0 && bills.every(isSplitBill);
  const done = hasBill && remainingTransferCount(members, bills, settlements) === 0;

  const steps: ProgressStep[] = [
    {
      key: "created",
      label: "Đã tạo bill",
      done: hasBill,
      hint: "Bill có đủ số tiền, người ứng và ngày chi.",
    },
    {
      key: "confirmed",
      label: "Đã xác nhận",
      done: confirmed,
      hint: "Mọi thành viên đã có phần trong bill.",
    },
    {
      key: "split",
      label: "Đã chia tiền",
      done: allSplit,
      hint: "Tất cả bill đã chia và khớp tổng.",
    },
    {
      key: "done",
      label: "Đã hoàn tất",
      done,
      hint: "Không còn khoản công nợ nào cần xử lý.",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length };
}

// ---------------------------------------------------------------------------
// 3.2 Huy hiệu cộng tác
// ---------------------------------------------------------------------------

export type Badge = {
  id: string;
  label: string;
  earned: boolean;
  reason: string; // vì sao nhận được / cần gì để nhận
};

export type BadgeInput = {
  members: Member[];
  bills: Bill[];
  settlements: Settlement[];
  /** userId đã khai báo tài khoản ngân hàng (cho huy hiệu "QR cứu nguy"). */
  bankAccountUserIds?: number[];
  /** Nhóm đã xuất/chia sẻ sao kê kỳ này (cho huy hiệu "Tháng minh bạch"). */
  exportedStatement?: boolean;
};

/**
 * 5 huy hiệu group-level (huy hiệu "Nhóm đúng hẹn" hoãn sang sau vì chưa có
 * khái niệm deadline). Mỗi huy hiệu earned=true khi có bằng chứng trong dữ liệu.
 */
export function computeBadges(input: BadgeInput): Badge[] {
  const { members, bills, settlements } = input;
  const bankSet = new Set(input.bankAccountUserIds ?? []);

  // Bill rõ ràng: có ≥1 bill đủ tên + tiền + người ứng + hạng mục + ngày.
  const clearBills = bills.filter(isClearBill);

  // Chia đều đẹp: có ≥1 bill mà toàn bộ thành viên đều tham gia share.
  const fullSplit = bills.some(
    (b) =>
      b.shares.length > 0 &&
      members.length > 0 &&
      members.every((m) => b.shares.some((s) => s.userId === m.userId))
  );

  // QR cứu nguy: có settlement mà người NHẬN đã khai báo TK ngân hàng.
  const qrRescue = settlements.some((s) => bankSet.has(s.toUserId));

  // Người tổ chức tốt: một thành viên đứng ứng ≥3 bill rõ ràng.
  const paidCount = new Map<number, number>();
  for (const b of clearBills) {
    paidCount.set(b.paidBy, (paidCount.get(b.paidBy) ?? 0) + 1);
  }
  const goodOrganizer = [...paidCount.values()].some((c) => c >= 3);

  // Tháng minh bạch: nhóm đã xuất sao kê.
  const transparent = !!input.exportedStatement;

  return [
    {
      id: "bill-ro-rang",
      label: "Bill rõ ràng",
      earned: clearBills.length > 0,
      reason: clearBills.length > 0
        ? "Đã có bill đủ tên, số tiền, người ứng và hạng mục."
        : "Thêm một bill đủ thông tin để nhận huy hiệu này.",
    },
    {
      id: "chia-deu-dep",
      label: "Chia đều đẹp",
      earned: fullSplit,
      reason: fullSplit
        ? "Cả nhóm đều có phần trong một bill."
        : "Khi mọi thành viên cùng tham gia một bill, huy hiệu sẽ mở.",
    },
    {
      id: "qr-cuu-nguy",
      label: "QR cứu nguy",
      earned: qrRescue,
      reason: qrRescue
        ? "Có khoản được thanh toán tới người đã gắn tài khoản ngân hàng."
        : "Gắn tài khoản ngân hàng để bạn bè quét QR trả nhanh.",
    },
    {
      id: "nguoi-to-chuc-tot",
      label: "Người tổ chức tốt",
      earned: goodOrganizer,
      reason: goodOrganizer
        ? "Một thành viên đã đứng ứng nhiều bill rõ ràng."
        : "Tạo nhiều bill rõ ràng giúp nhóm giữ sổ sách gọn gàng.",
    },
    {
      id: "thang-minh-bach",
      label: "Tháng minh bạch",
      earned: transparent,
      reason: transparent
        ? "Nhóm đã có sao kê để cả nhóm cùng xem."
        : "Xuất sao kê cuối kỳ để mở huy hiệu này.",
    },
  ];
}

// ---------------------------------------------------------------------------
// 3.3 Năng lượng nhóm (không hiển thị điểm số tuyệt đối)
// ---------------------------------------------------------------------------

export type EnergyState = "starting" | "coordinating" | "flowing" | "done";

export type TeamEnergy = {
  state: EnergyState;
  label: string;
  hint: string;
};

const ENERGY_LABEL: Record<EnergyState, string> = {
  starting: "Đang khởi động",
  coordinating: "Đang phối hợp",
  flowing: "Đã vào guồng",
  done: "Đã hoàn tất kỳ này",
};

export function teamEnergy(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[],
  opts?: { exportedStatement?: boolean }
): TeamEnergy {
  if (bills.length === 0) {
    return {
      state: "starting",
      label: ENERGY_LABEL.starting,
      hint: "Thêm bill đầu tiên để nhóm bắt đầu.",
    };
  }

  const confirmed = everyoneParticipates(members, bills);
  const debtsHandled = remainingTransferCount(members, bills, settlements) === 0;
  const shared = !!opts?.exportedStatement;

  const score = (confirmed ? 1 : 0) + (debtsHandled ? 1 : 0) + (shared ? 1 : 0);
  const state: EnergyState =
    score >= 3 ? "done" : score === 2 ? "flowing" : score === 1 ? "coordinating" : "starting";

  const hint =
    state === "done"
      ? "Không còn khoản cần xử lý trong kỳ này."
      : state === "flowing"
        ? "Công nợ được cập nhật đều, gần khép kỳ."
        : state === "coordinating"
          ? "Đa số bill đã rõ, còn vài khoản cần xử lý."
          : "Nhóm mới có bill hoặc còn thiếu người xác nhận.";

  return { state, label: ENERGY_LABEL[state], hint };
}

// ---------------------------------------------------------------------------
// 3.4 Nhiệm vụ theo ngữ cảnh (chỉ hiện khi có điều kiện thật)
// ---------------------------------------------------------------------------

export type ContextTask = {
  id: string;
  label: string;
  hint: string;
  count: number;
};

export function contextTasks(
  members: Member[],
  bills: Bill[],
  settlements: Settlement[],
  opts?: { exportedStatement?: boolean }
): ContextTask[] {
  const tasks: ContextTask[] = [];

  // Bill còn thiếu thông tin / chưa chia xong.
  const pending = bills.filter((b) => !isSplitBill(b) || !isClearBill(b));
  if (pending.length > 0) {
    tasks.push({
      id: "don-bill-cho",
      label: `Dọn ${pending.length} bill đang chờ`,
      hint: "Bổ sung thông tin còn thiếu để chia tiền nhanh.",
      count: pending.length,
    });
  }

  // Còn công nợ chưa xử lý.
  const remaining = remainingTransferCount(members, bills, settlements);
  if (remaining > 0) {
    tasks.push({
      id: "chot-nhom-hom-nay",
      label: "Chốt nhóm hôm nay",
      hint: `Còn ${remaining} khoản để khép kỳ này.`,
      count: remaining,
    });
  }

  // Chưa xác nhận đủ người.
  if (bills.length > 0 && !everyoneParticipates(members, bills)) {
    const ids = participantIds(bills);
    const missing = members.filter((m) => !ids.has(m.userId)).length;
    if (missing > 0) {
      tasks.push({
        id: "cung-kiem-tra",
        label: "Cùng kiểm tra trước khi lưu",
        hint: `Còn ${missing} người chưa có phần trong bill nào.`,
        count: missing,
      });
    }
  }

  // Sạch nợ nhưng chưa có sao kê → gợi ý chia sẻ sao kê.
  if (bills.length > 0 && remaining === 0 && !opts?.exportedStatement) {
    tasks.push({
      id: "gui-sao-ke",
      label: "Gửi sao kê cuối tuần",
      hint: "Nhóm đã sạch nợ — chia sẻ sao kê cho minh bạch.",
      count: 1,
    });
  }

  return tasks;
}
