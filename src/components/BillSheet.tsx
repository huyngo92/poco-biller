"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client";
import { formatVnd } from "@/lib/money";
import { categoryLabel, SPLIT_MODE_LABEL, type Bill } from "@/lib/types";
import { formatDateVn } from "@/lib/period";
import { IconAlert, IconClose, IconTrash, IconSpinner, ICON_SIZE } from "./Icons";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Nhập tay",
  ocr: "Chụp hoá đơn",
  chat: "Nhập qua chat",
  import: "Nhập từ file",
};

export default function BillSheet({
  bill,
  currentUserId,
  onClose,
  onDeleted,
}: {
  bill: Bill;
  currentUserId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/bills/${bill.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được bill.");
      setBusy(false);
    }
  }

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết bill ${bill.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="row" style={{ marginBottom: 4 }}>
          <h2>{bill.title}</h2>
          <span className="spacer" />
          {/* Nút đóng tròn ở góc phải — quy ước của sheet iOS */}
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Đóng chi tiết bill"
          >
            <IconClose size={ICON_SIZE.md} />
          </button>
        </div>

        <p className="num amount-lg" style={{ margin: "6px 0 2px" }}>
          {formatVnd(bill.total)}
        </p>
        <p className="faint" style={{ marginTop: 0 }}>
          {formatDateVn(bill.spentOn)} · {categoryLabel(bill.category)} ·{" "}
          {bill.paidByName} ứng tiền
        </p>

        <div className="row-wrap" style={{ marginBottom: 12 }}>
          <span className="tag">{SPLIT_MODE_LABEL[bill.splitMode]}</span>
          <span className="tag">{SOURCE_LABEL[bill.source] ?? bill.source}</span>
        </div>

        {bill.note && (
          <p className="muted" style={{ marginTop: 0 }}>
            {bill.note}
          </p>
        )}

        <div className="divider" />

        <p className="section-title" style={{ marginBottom: 6 }}>
          Phần của từng người
        </p>
        <div>
          {bill.shares.map((s) => (
            <div className="split-row" key={s.userId} style={{ gridTemplateColumns: "1fr auto" }}>
              <span>
                {s.name}
                {s.userId === currentUserId && (
                  <span className="tag tag-blue" style={{ marginLeft: 6 }}>
                    Bạn
                  </span>
                )}
              </span>
              <span className="num split-amount">{formatVnd(s.amount)}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="error" style={{ marginTop: 12 }} role="alert">
            <IconAlert size={ICON_SIZE.sm} />
            <span>{error}</span>
          </p>
        )}

        <div className="divider" />

        {confirming ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Xoá bill này khỏi sổ? Số dư của mọi người sẽ được tính lại.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={remove}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <IconSpinner size={ICON_SIZE.sm} /> Đang xoá…
                  </>
                ) : (
                  <>
                    <IconTrash size={ICON_SIZE.sm} /> Xoá bill
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Giữ lại
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => setConfirming(true)}
          >
            <IconTrash size={ICON_SIZE.sm} /> Xoá bill
          </button>
        )}
      </div>
    </div>
  );
}
