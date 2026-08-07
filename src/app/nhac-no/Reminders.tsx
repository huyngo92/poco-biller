"use client";

import { useState, useEffect, useCallback } from "react";
import type { Group, SessionUser } from "@/lib/types";
import type { Reminder } from "@/lib/logic";
import { apiJson, rememberGroupId, resolveGroup } from "@/lib/client";
import { formatVnd } from "@/lib/money";
import { today } from "@/lib/period";
import { sepayQrUrl } from "@/lib/qr";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import CopyButton from "@/components/CopyButton";
import CopyImageButton from "@/components/CopyImageButton";
import {
  IconAlert,
  IconArrowRight,
  IconBell,
  IconOk,
  IconSettle,
  IconSpinner,
  ICON_SIZE,
} from "@/components/Icons";

/** Khoá nhận diện một reminder khi không có id cố định — dùng để đánh dấu
 *  "đã xác nhận" cục bộ ngay khi bấm, trước khi danh sách tải lại từ server. */
function reminderKey(r: Reminder): string {
  return `${r.debtor.id}-${r.creditor.user.id}-${r.amount}`;
}

/** Sao kê tổng hợp toàn nhóm — không kèm QR/số tài khoản, chỉ để dán lên
 *  group chat cho mọi người cùng xem ai nợ ai. */
function generateGroupSummaryMessage(groupName: string, reminders: Reminder[]): string {
  if (reminders.length === 0) {
    return `📊 Sao kê nợ nhóm ${groupName}\n\nCả nhóm đã sòng phẳng, không ai còn nợ ai.`;
  }

  const lines = reminders
    .map((r) => `- ${r.debtor.name} nợ ${r.creditor.user.name}: ${formatVnd(r.amount)}`)
    .join("\n");

  const total = reminders.reduce((sum, r) => sum + r.amount, 0);

  return `📊 Sao kê nợ nhóm ${groupName}\n\n${lines}\n\nTổng cộng: ${formatVnd(total)}`;
}

function generateReminderMessage(reminder: Reminder): string {
  const { debtor, creditor, amount } = reminder;
  const formattedAmount = formatVnd(amount);

  let message = `${debtor.name} ơi, bạn chuyển khoản cho ${creditor.user.name} ${formattedAmount} tiền bill nhóm nhé.`;

  if (creditor.bankAccount) {
    const { bank, accountName, accountNumber } = creditor.bankAccount;
    message += `\n\nThông tin chuyển khoản:`;
    if (bank) {
      message += `\n- Ngân hàng: ${bank.shortName}`;
    }
    message += `\n- Số tài khoản: ${accountNumber}`;
    message += `\n- Chủ tài khoản: ${accountName}`;
  }

  message += `\n\nCảm ơn bạn!`;
  return message;
}

function ReminderCard({
  reminder,
  currentUserId,
  confirming,
  settling,
  onSettle,
}: {
  reminder: Reminder;
  currentUserId: number;
  confirming: boolean;
  settling: boolean;
  onSettle: () => void;
}) {
  const message = generateReminderMessage(reminder);
  const { debtor, creditor, amount } = reminder;
  const bankAccount = creditor.bankAccount;

  // Ảnh QR VietQR động của SePay — chỉ sinh được khi ngân hàng nằm trong
  // danh sách SePay hỗ trợ (có sepayCode) và người nhận đã khai số tài khoản.
  const qrUrl = bankAccount?.bank
    ? sepayQrUrl({
        bankId: bankAccount.bank.id,
        accountNumber: bankAccount.accountNumber,
        amount,
        description: `${debtor.name} tra no bill nhom`,
      })
    : null;

  // Cả người nợ và người nhận đều xác nhận được — hai bên chỉ cần một trong
  // hai xác nhận là khoản này coi như đã trả (giống thoả thuận ngoài đời).
  const canConfirm = debtor.id === currentUserId || creditor.user.id === currentUserId;

  return (
    <div className="card card-pad stack">
      <div className="row">
        <div className="stack" style={{ alignItems: "center", gap: 4 }}>
          <span className="tag">{debtor.name}</span>
          <span className="faint">Nợ</span>
        </div>
        <IconArrowRight size={ICON_SIZE.sm} className="faint" />
        <div className="stack" style={{ alignItems: "center", gap: 4 }}>
          <span className="tag tag-blue">{creditor.user.name}</span>
          <span className="faint">Số tiền</span>
        </div>
        <span className="spacer" />
        <strong className="num">{formatVnd(amount)}</strong>
      </div>
      {bankAccount?.bank?.logo && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <img
            src={bankAccount.bank.logo}
            alt={bankAccount.bank.shortName}
            style={{ maxHeight: "30px", borderRadius: "4px" }}
          />
        </div>
      )}
      {qrUrl && (
        <div
          className="stack"
          style={{ alignItems: "center", gap: 6, padding: "4px 0 8px" }}
        >
          <img
            src={qrUrl}
            alt={`Mã QR chuyển khoản cho ${creditor.user.name}`}
            width={180}
            height={180}
            style={{ borderRadius: 8, border: "1px solid var(--rule)" }}
          />
          <div className="row-wrap" style={{ justifyContent: "center" }}>
            <span className="faint tiny">Quét mã để chuyển khoản nhanh</span>
          </div>
          <CopyImageButton imageUrl={qrUrl} label="Copy ảnh QR" />
        </div>
      )}
      <CopyButton
        text={message}
        label="Copy lời nhắc"
        className="btn-block"
      />
      {canConfirm && (
        <button
          type="button"
          className={`btn btn-block ${confirming ? "" : "btn-primary"}`}
          disabled={settling}
          onClick={onSettle}
        >
          {settling ? (
            <>
              <IconSpinner size={ICON_SIZE.sm} /> Đang ghi nhận...
            </>
          ) : confirming ? (
            <>
              <IconOk size={ICON_SIZE.sm} /> Bấm lại để xác nhận đã trả
            </>
          ) : (
            <>
              <IconSettle size={ICON_SIZE.sm} />{" "}
              {debtor.id === currentUserId
                ? "Xác nhận đã chuyển khoản"
                : "Xác nhận đã nhận tiền"}
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function Reminders({
  initialReminders,
  groups,
  user,
}: {
  initialReminders: Reminder[];
  groups: Group[];
  user: SessionUser;
}) {
  const [reminders, setReminders] = useState(initialReminders);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const loadReminders = useCallback(async (groupId: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson<{ reminders: Reminder[] }>(
        `/api/groups/${groupId}/reminders`
      );
      setReminders(data.reminders);
    } catch (e) {
      console.error("Failed to load reminders", e);
      setReminders([]);
      setError(e instanceof Error ? e.message : "Không tải được danh sách nhắc nợ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => setGroup(resolveGroup(groups)), [groups]);

  // Load reminders khi group được xác định
  useEffect(() => {
    if (group?.id) {
      void loadReminders(group.id);
    }
  }, [group?.id, loadReminders]);

  const handleGroupChange = (newGroup: Group) => {
    rememberGroupId(newGroup.id);
    setGroup(newGroup);
    void loadReminders(newGroup.id);
  };

  /**
   * Ghi một khoản `settlements` khớp đúng khoản nợ này, rồi tải lại danh sách
   * để số dư tính lại — bấm lần đầu chỉ vào trạng thái "chờ xác nhận", phải
   * bấm lần hai mới thực sự ghi, tránh xác nhận nhầm cho khoản tiền lớn.
   */
  async function handleSettle(r: Reminder) {
    const key = reminderKey(r);
    if (confirmingKey !== key) {
      setConfirmingKey(key);
      return;
    }
    setConfirmingKey(null);
    setSettlingKey(key);
    setError("");
    try {
      await apiJson("/api/settlements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupId: r.groupId,
          fromUserId: r.debtor.id,
          toUserId: r.creditor.user.id,
          amount: r.amount,
          paidOn: today(),
          note: "Xác nhận từ trang Nhắc nợ",
        }),
      });
      await loadReminders(r.groupId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ghi nhận được thanh toán.");
    } finally {
      setSettlingKey(null);
    }
  }

  const myDebts = reminders.filter((r) => r.debtor.id === user.id);
  const debtsToMe = reminders.filter((r) => r.creditor.user.id === user.id);
  const otherDebts = reminders.filter(
    (r) => r.debtor.id !== user.id && r.creditor.user.id !== user.id
  );

  const totalIOwe = myDebts.reduce((sum, r) => sum + r.amount, 0);
  const totalOwedToMe = debtsToMe.reduce((sum, r) => sum + r.amount, 0);

  return (
    <PullToRefresh onRefresh={() => group ? loadReminders(group.id) : Promise.resolve()}>
    <div className="shell">
      <header className="topbar">
        <IconBell size={22} style={{ color: "var(--tint-strong)" }} />
        <span className="brand">Nhắc nợ</span>
        <span className="spacer" />
        {group && (
          <GroupPicker
            groups={groups}
            current={group}
            onChange={handleGroupChange}
          />
        )}
      </header>

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {!loading && reminders.length > 0 && (
        <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
          <div className="stats">
            <div className="stat">
              <p className="stat-label">Bạn cần trả</p>
              <p className="num stat-value debt">{formatVnd(totalIOwe)}</p>
            </div>
            <div className="stat">
              <p className="stat-label">Bạn sẽ được nhận</p>
              <p className="num stat-value credit">{formatVnd(totalOwedToMe)}</p>
            </div>
          </div>
          <CopyButton
            text={generateGroupSummaryMessage(group?.name ?? "", reminders)}
            label="Copy sao kê cho nhóm"
            className="btn btn-block"
          />
        </div>
      )}

      {loading ? (
        <div className="empty">Đang tính toán...</div>
      ) : reminders.length === 0 ? (
        <div className="empty stack" style={{ gap: 12 }}>
          <p className="empty-title">Sòng phẳng!</p>
          <p>Mọi người trong nhóm đã thanh toán hết nợ cho nhau.</p>
          <CopyButton
            text={generateGroupSummaryMessage(group?.name ?? "", reminders)}
            label="Copy sao kê cho nhóm"
            className="btn btn-block"
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 28 }}>
          {myDebts.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <h2 className="section-title">Bạn cần trả</h2>
              <div className="stack" style={{ gap: 10 }}>
                {myDebts.map((r, i) => (
                  <ReminderCard
                    key={`my-debt-${i}`}
                    reminder={r}
                    currentUserId={user.id}
                    confirming={confirmingKey === reminderKey(r)}
                    settling={settlingKey === reminderKey(r)}
                    onSettle={() => handleSettle(r)}
                  />
                ))}
              </div>
            </div>
          )}
          {debtsToMe.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <h2 className="section-title">Người khác cần trả bạn</h2>
              <div className="stack" style={{ gap: 10 }}>
                {debtsToMe.map((r, i) => (
                  <ReminderCard
                    key={`to-me-${i}`}
                    reminder={r}
                    currentUserId={user.id}
                    confirming={confirmingKey === reminderKey(r)}
                    settling={settlingKey === reminderKey(r)}
                    onSettle={() => handleSettle(r)}
                  />
                ))}
              </div>
            </div>
          )}
          {otherDebts.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <h2 className="section-title">Nợ chung trong nhóm</h2>
              <div className="stack" style={{ gap: 10 }}>
                {otherDebts.map((r, i) => (
                  <ReminderCard
                    key={`other-${i}`}
                    reminder={r}
                    currentUserId={user.id}
                    confirming={confirmingKey === reminderKey(r)}
                    settling={settlingKey === reminderKey(r)}
                    onSettle={() => handleSettle(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
