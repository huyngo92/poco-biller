"use client";

import { useState, useEffect, useCallback } from "react";
import type { Group, SessionUser } from "@/lib/types";
import type { Reminder } from "@/lib/logic";
import { apiJson, rememberGroupId, resolveGroup } from "@/lib/client";
import { formatVnd } from "@/lib/money";
import { GROUP_SUMMARY_QUOTES, pickQuote } from "@/lib/quotes";
import { today } from "@/lib/period";
import { sepayQrUrl } from "@/lib/qr";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import CopyButton from "@/components/CopyButton";
import CopyImageButton from "@/components/CopyImageButton";
import Celebration from "@/components/Celebration";
import ReminderToneSheet from "@/components/ReminderToneSheet";
import { SkeletonLedgerRows } from "@/components/Skeleton";
import Avatar from "@/components/Avatar";
import {
  IconAlert,
  IconBell,
  IconChevron,
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

/** Sao kê tổng hợp toàn nhóm */
function generateGroupSummaryMessage(groupName: string, reminders: Reminder[]): string {
  const quote = pickQuote(GROUP_SUMMARY_QUOTES);

  if (reminders.length === 0) {
    return `${quote}\n\nNhóm ${groupName} — sao kê tháng này sạch bong, không ai nợ ai cả 🎉`;
  }

  const lines = reminders
    .map((r) => `• ${r.debtor.name} nợ ${r.creditor.user.name}: ${formatVnd(r.amount)}`)
    .join("\n");

  const total = reminders.reduce((sum, r) => sum + r.amount, 0);

  return `${quote}\n\nNhóm ${groupName} — sao kê nợ:\n${lines}\n\nTổng cộng: ${formatVnd(total)}`;
}

const VARIANT_AMOUNT_CLASS: Record<"mine" | "theirs" | "other", string> = {
  mine: "debt",
  theirs: "credit",
  other: "",
};

const VARIANT_STATUS_TEXT: Record<"mine" | "theirs" | "other", string> = {
  mine: "Bạn cần trả",
  theirs: "Bạn sẽ nhận",
  other: "",
};

function reminderTitle(r: Reminder, variant: "mine" | "theirs" | "other"): string {
  if (variant === "mine") return `Trả cho ${r.creditor.user.name}`;
  if (variant === "theirs") return `${r.debtor.name} cần trả bạn`;
  return `${r.debtor.name} → ${r.creditor.user.name}`;
}

function ReminderRow({
  reminder,
  variant,
  currentUserId,
  confirming,
  settling,
  onSettle,
  groupName,
}: {
  reminder: Reminder;
  variant: "mine" | "theirs" | "other";
  currentUserId: number;
  confirming: boolean;
  settling: boolean;
  onSettle: () => void;
  groupName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
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

  // Gợi ý nhỏ dưới tên — giống nhãn hạng mục/số người dưới tên bill ở "Bill
  // gần đây": chỉ hiện khi có thông tin thật (đã liên kết ngân hàng hay chưa),
  // và chỉ với 2 phía trực tiếp liên quan (không hiện ở "Nợ chung trong nhóm").
  const subtitle =
    variant === "other"
      ? null
      : bankAccount?.bank
        ? `Qua ${bankAccount.bank.shortName}`
        : "Chưa liên kết ngân hàng";

  return (
    <>
      <button
        type="button"
        className="entry"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {variant === "other" ? (
          <span className="avatar-stack">
            <Avatar name={debtor.name} size={24} />
            <Avatar name={creditor.user.name} size={24} />
          </span>
        ) : (
          <Avatar name={variant === "mine" ? creditor.user.name : debtor.name} size={32} />
        )}
        <span className="entry-main">
          <span className="entry-title">{reminderTitle(reminder, variant)}</span>
          {subtitle && (
            <span className="faint tiny" style={{ display: "block", marginTop: 2 }}>
              {subtitle}
            </span>
          )}
        </span>
        <span className="entry-amount">
          <span className="num">{formatVnd(amount)}</span>
          {VARIANT_STATUS_TEXT[variant] && (
            <span
              className={`tiny num ${VARIANT_AMOUNT_CLASS[variant]}`}
              style={{ display: "block" }}
            >
              {VARIANT_STATUS_TEXT[variant]}
            </span>
          )}
        </span>
        <IconChevron
          size={ICON_SIZE.sm}
          className="entry-chevron"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
        />
      </button>
      {expanded && (
        <div className="stack" style={{ padding: "0 16px 16px", gap: 10 }}>
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
          <button
            type="button"
            className="btn btn-block"
            onClick={() => setToneOpen(true)}
          >
            <IconBell size={ICON_SIZE.sm} /> Gửi lời nhắc
          </button>
          {toneOpen && (
            <ReminderToneSheet
              reminder={reminder}
              groupName={groupName}
              onClose={() => setToneOpen(false)}
            />
          )}
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
      )}
    </>
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
        <div className="card">
          <SkeletonLedgerRows count={3} />
        </div>
      ) : reminders.length === 0 ? (
        <Celebration
          title="Sòng phẳng!"
          subtitle="Mọi người trong nhóm đã thanh toán hết nợ cho nhau."
          actions={
            <CopyButton
              text={generateGroupSummaryMessage(group?.name ?? "", reminders)}
              label="Copy sao kê cho nhóm"
              className="btn btn-block"
            />
          }
        />
      ) : (
        <div className="card">
          <ul className="ledger">
            {myDebts.length > 0 && (
              <>
                <li className="ledger-label">Bạn cần trả</li>
                {myDebts.map((r, i) => (
                  <li key={`my-debt-${i}`}>
                    <ReminderRow
                      variant="mine"
                      reminder={r}
                      currentUserId={user.id}
                      groupName={group?.name ?? ""}
                      confirming={confirmingKey === reminderKey(r)}
                      settling={settlingKey === reminderKey(r)}
                      onSettle={() => handleSettle(r)}
                    />
                  </li>
                ))}
              </>
            )}
            {debtsToMe.length > 0 && (
              <>
                <li className="ledger-label">Người khác cần trả bạn</li>
                {debtsToMe.map((r, i) => (
                  <li key={`to-me-${i}`}>
                    <ReminderRow
                      variant="theirs"
                      reminder={r}
                      currentUserId={user.id}
                      groupName={group?.name ?? ""}
                      confirming={confirmingKey === reminderKey(r)}
                      settling={settlingKey === reminderKey(r)}
                      onSettle={() => handleSettle(r)}
                    />
                  </li>
                ))}
              </>
            )}
            {otherDebts.length > 0 && (
              <>
                <li className="ledger-label">Nợ chung trong nhóm</li>
                {otherDebts.map((r, i) => (
                  <li key={`other-${i}`}>
                    <ReminderRow
                      variant="other"
                      reminder={r}
                      currentUserId={user.id}
                      groupName={group?.name ?? ""}
                      confirming={confirmingKey === reminderKey(r)}
                      settling={settlingKey === reminderKey(r)}
                      onSettle={() => handleSettle(r)}
                    />
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
