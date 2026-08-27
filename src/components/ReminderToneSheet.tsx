"use client";

import { useMemo, useState } from "react";
import type { Reminder } from "@/lib/logic";
import { formatVnd } from "@/lib/money";
import { sepayQrUrl } from "@/lib/qr";
import CopyButton from "./CopyButton";
import CopyImageButton from "./CopyImageButton";
import { IconClose, ICON_SIZE } from "./Icons";

type Tone = "gentle" | "qr" | "custom";

const TONES: { id: Tone; label: string }[] = [
  { id: "gentle", label: "Nhẹ nhàng" },
  { id: "qr", label: "Kèm QR" },
  { id: "custom", label: "Tự viết" },
];

/** Lời nhắc dùng ngôn ngữ trung tính, không tạo áp lực xã hội. */
function gentleMessage(r: Reminder, groupName: string): string {
  return `${r.debtor.name} ơi, khi tiện bạn kiểm tra giúp khoản ${formatVnd(
    r.amount
  )} trong nhóm ${groupName || "mình"} nhé. Cảm ơn bạn!`;
}

function qrMessage(r: Reminder, groupName: string): string {
  let msg = `Mình gửi thông tin để bạn thanh toán nhanh khoản ${formatVnd(
    r.amount
  )} trong nhóm ${groupName || "mình"} nhé.`;
  const acc = r.creditor.bankAccount;
  if (acc) {
    msg += `\n\nChuyển khoản:`;
    if (acc.bank) msg += `\n• Ngân hàng: ${acc.bank.shortName}`;
    msg += `\n• Số tài khoản: ${acc.accountNumber}`;
    msg += `\n• Chủ tài khoản: ${acc.accountName}`;
  }
  return msg;
}

/**
 * Bottom sheet chọn tông giọng lời nhắc: Nhẹ nhàng / Kèm QR / Tự viết.
 * Không hiển thị số lần nhắc hay bảng theo dõi — tôn trọng người nhận.
 */
export default function ReminderToneSheet({
  reminder,
  groupName,
  onClose,
}: {
  reminder: Reminder;
  groupName: string;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<Tone>("gentle");
  const [custom, setCustom] = useState(() => gentleMessage(reminder, groupName));

  const acc = reminder.creditor.bankAccount;
  const qrUrl = useMemo(
    () =>
      acc?.bank
        ? sepayQrUrl({
            bankId: acc.bank.id,
            accountNumber: acc.accountNumber,
            amount: reminder.amount,
            description: `${reminder.debtor.name} tra no bill nhom`,
          })
        : null,
    [acc, reminder.amount, reminder.debtor.name]
  );

  const message =
    tone === "gentle"
      ? gentleMessage(reminder, groupName)
      : tone === "qr"
        ? qrMessage(reminder, groupName)
        : custom;

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Gửi lời nhắc cho ${reminder.debtor.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Gửi lời nhắc cho {reminder.debtor.name}</h2>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Đóng"
          >
            <IconClose size={ICON_SIZE.md} />
          </button>
        </div>

        <div className="segmented" role="group" aria-label="Tông giọng" style={{ marginBottom: 14 }}>
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="segment"
              aria-pressed={tone === t.id}
              onClick={() => setTone(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tone === "custom" ? (
          <textarea
            className="input"
            rows={5}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Nội dung lời nhắc"
            style={{ resize: "vertical", marginBottom: 12 }}
          />
        ) : (
          <p className="tone-preview">{message}</p>
        )}

        {tone === "qr" && qrUrl && (
          <div className="stack" style={{ alignItems: "center", gap: 6, marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`Mã QR chuyển khoản cho ${reminder.creditor.user.name}`}
              width={180}
              height={180}
              style={{ borderRadius: 8, border: "1px solid var(--rule)" }}
            />
            <CopyImageButton imageUrl={qrUrl} label="Copy ảnh QR" />
          </div>
        )}
        {tone === "qr" && !qrUrl && (
          <p className="faint tiny" style={{ marginTop: 0 }}>
            Người nhận chưa gắn tài khoản ngân hàng nên chưa tạo được QR.
          </p>
        )}

        <CopyButton text={message} label="Copy lời nhắc" className="btn btn-primary btn-block" />
      </div>
    </div>
  );
}
