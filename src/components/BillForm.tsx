"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/client";
import { formatVnd, parseVnd, splitByWeights } from "@/lib/money";
import {
  CATEGORIES,
  SPLIT_MODE_LABEL,
  type Member,
  type SplitMode,
} from "@/lib/types";
import { today } from "@/lib/period";
import { IconAlert, IconCheck, IconSpinner, ICON_SIZE } from "./Icons";

export type BillDraft = {
  title: string;
  category: string;
  totalText: string;
  paidBy: number;
  spentOn: string;
  note: string;
  splitMode: SplitMode;
  /** userId -> đang tham gia chia */
  selected: Record<number, boolean>;
  /** userId -> số phần (shares) hoặc phần trăm */
  weights: Record<number, number>;
  /** userId -> số tiền gõ tay khi splitMode = exact */
  exact: Record<number, string>;
};

export function emptyDraft(members: Member[], currentUserId: number): BillDraft {
  return {
    title: "",
    category: "an-uong",
    totalText: "",
    paidBy: currentUserId,
    spentOn: today(),
    note: "",
    splitMode: "equal",
    selected: Object.fromEntries(members.map((m) => [m.userId, true])),
    weights: Object.fromEntries(members.map((m) => [m.userId, 1])),
    exact: Object.fromEntries(members.map((m) => [m.userId, ""])),
  };
}

const MODES: SplitMode[] = ["equal", "shares", "percent", "exact"];

export default function BillForm({
  groupId,
  members,
  currentUserId,
  draft,
  setDraft,
  source,
  onSaved,
}: {
  groupId: number;
  members: Member[];
  currentUserId: number;
  draft: BillDraft;
  setDraft: (d: BillDraft) => void;
  source: string;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => parseVnd(draft.totalText) ?? 0, [draft.totalText]);
  const participants = members.filter((m) => draft.selected[m.userId]);

  // Số tiền dự kiến của từng người, tính ngay trên máy để xem trước
  const preview = useMemo(() => {
    if (participants.length === 0 || total <= 0) return new Map<number, number>();

    if (draft.splitMode === "exact") {
      return new Map(
        participants.map((m) => [m.userId, parseVnd(draft.exact[m.userId] ?? "") ?? 0])
      );
    }

    const weights = participants.map((m) =>
      draft.splitMode === "equal" ? 1 : Math.max(0, draft.weights[m.userId] ?? 0)
    );
    const amounts = splitByWeights(total, weights);
    return new Map(participants.map((m, i) => [m.userId, amounts[i]]));
  }, [participants, total, draft.splitMode, draft.weights, draft.exact]);

  const previewSum = [...preview.values()].reduce((a, b) => a + b, 0);
  const exactMismatch =
    draft.splitMode === "exact" && total > 0 && previewSum !== total;

  // Chuyển sang nhập tay thì mồi sẵn số tiền đang chia đều cho dễ sửa
  useEffect(() => {
    if (draft.splitMode !== "exact" || total <= 0) return;
    const empty = participants.every((m) => !draft.exact[m.userId]);
    if (!empty) return;
    const weights = participants.map(() => 1);
    const amounts = splitByWeights(total, weights);
    const next = { ...draft.exact };
    participants.forEach((m, i) => {
      next[m.userId] = String(amounts[i]);
    });
    setDraft({ ...draft, exact: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.splitMode]);

  async function save() {
    setError("");

    if (!draft.title.trim()) {
      setError("Bạn đặt tên cho bill giúp, ví dụ “Ăn trưa quán Cô Ba”.");
      return;
    }
    if (total <= 0) {
      setError("Số tiền chưa hợp lệ. Bạn gõ ví dụ 450k hoặc 450.000.");
      return;
    }
    if (participants.length === 0) {
      setError("Chọn ít nhất một người cùng chia.");
      return;
    }
    if (exactMismatch) {
      setError(
        `Tổng các phần đang là ${formatVnd(previewSum)}, chưa khớp tổng bill ${formatVnd(total)}.`
      );
      return;
    }

    setBusy(true);
    try {
      await apiJson("/api/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: draft.title.trim(),
          category: draft.category,
          total,
          paidBy: draft.paidBy,
          spentOn: draft.spentOn,
          note: draft.note,
          splitMode: draft.splitMode,
          source,
          shares: participants.map((m) => ({
            userId: m.userId,
            weight:
              draft.splitMode === "equal" ? 1 : draft.weights[m.userId] ?? 0,
            amount: preview.get(m.userId) ?? 0,
          })),
        }),
      });
      onSaved("Đã lưu bill vào sổ.");
      setDraft(emptyDraft(members, currentUserId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card card-pad stack">
        <div className="field">
          <label className="label" htmlFor="title">
            Bill này là gì
          </label>
          <input
            id="title"
            className="input"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Ăn trưa quán Cô Ba"
          />
        </div>

        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="total">
              Tổng tiền
            </label>
            <input
              id="total"
              className="input input-money"
              inputMode="decimal"
              value={draft.totalText}
              onChange={(e) => setDraft({ ...draft, totalText: e.target.value })}
              placeholder="450k"
            />
            <span className="hint">
              {total > 0 ? formatVnd(total) : "Gõ 450k, 1tr2 hoặc 450.000"}
            </span>
          </div>

          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="spentOn">
              Ngày chi
            </label>
            <input
              id="spentOn"
              type="date"
              className="input"
              value={draft.spentOn}
              onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })}
            />
          </div>
        </div>

        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="paidBy">
              Ai ứng tiền
            </label>
            <select
              id="paidBy"
              className="select"
              value={draft.paidBy}
              onChange={(e) => setDraft({ ...draft, paidBy: Number(e.target.value) })}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.userId === currentUserId ? " (bạn)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ flex: 1 }}>
            <label className="label" htmlFor="category">
              Nhóm chi phí
            </label>
            <select
              id="category"
              className="select"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="note">
            Ghi chú
          </label>
          <input
            id="note"
            className="input"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="Không bắt buộc"
          />
        </div>
      </div>

      <div className="card card-pad stack">
        <div>
          <p className="section-title" style={{ marginBottom: 8 }}>
            Chia thế nào
          </p>
          <div className="chips">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={draft.splitMode === m}
                onClick={() => setDraft({ ...draft, splitMode: m })}
              >
                {SPLIT_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          {members.map((m) => {
            const on = Boolean(draft.selected[m.userId]);
            return (
              <div className="split-row" key={m.userId}>
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={`Chia cho ${m.name}`}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      selected: { ...draft.selected, [m.userId]: e.target.checked },
                    })
                  }
                />
                <span style={{ opacity: on ? 1 : 0.45 }}>
                  {m.name}
                  {m.userId === currentUserId && (
                    <span className="tag tag-blue" style={{ marginLeft: 6 }}>
                      Bạn
                    </span>
                  )}
                </span>

                {!on ? (
                  <span className="faint" style={{ textAlign: "right" }}>
                    —
                  </span>
                ) : draft.splitMode === "equal" ? (
                  <span className="num split-amount">
                    {formatVnd(preview.get(m.userId) ?? 0)}
                  </span>
                ) : draft.splitMode === "exact" ? (
                  <input
                    className="input input-money"
                    inputMode="decimal"
                    aria-label={`Số tiền của ${m.name}`}
                    value={draft.exact[m.userId] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        exact: { ...draft.exact, [m.userId]: e.target.value },
                      })
                    }
                    style={{ padding: "6px 8px", fontSize: 14 }}
                  />
                ) : (
                  <span>
                    <input
                      className="input input-money"
                      inputMode="decimal"
                      aria-label={
                        draft.splitMode === "percent"
                          ? `Phần trăm của ${m.name}`
                          : `Số phần của ${m.name}`
                      }
                      value={draft.weights[m.userId] ?? 0}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          weights: {
                            ...draft.weights,
                            [m.userId]: Number(e.target.value) || 0,
                          },
                        })
                      }
                      style={{ padding: "6px 8px", fontSize: 14 }}
                    />
                    <span className="faint tiny num" style={{ display: "block", textAlign: "right" }}>
                      {formatVnd(preview.get(m.userId) ?? 0)}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {draft.splitMode === "percent" && (
          <p className="hint">
            Tổng phần trăm không cần đúng 100 — hệ thống chia theo tỷ lệ tương đối.
          </p>
        )}

        <div className="row">
          <span className="muted">Tổng các phần</span>
          <span className="spacer" />
          <span className={`num ${exactMismatch ? "debt" : ""}`}>
            {formatVnd(previewSum)}
          </span>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={save}
        disabled={busy}
      >
        {busy ? (
          <>
            <IconSpinner size={ICON_SIZE.md} /> Đang lưu
          </>
        ) : (
          <>
            <IconCheck size={ICON_SIZE.md} /> Lưu bill
          </>
        )}
      </button>
    </div>
  );
}
