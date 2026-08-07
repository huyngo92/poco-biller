"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, rememberGroupId, resolveGroup } from "@/lib/client";
import { formatVnd } from "@/lib/money";
import type {
  ChatDraft,
  Group,
  Member,
  OcrResult,
  SessionUser,
} from "@/lib/types";
import GroupPicker from "@/components/GroupPicker";
import BillForm, { emptyDraft, type BillDraft } from "@/components/BillForm";
import {
  IconAlert,
  IconCamera,
  IconChat,
  IconOk,
  IconPen,
  IconSpinner,
  ICON_SIZE,
} from "@/components/Icons";

type Mode = "photo" | "chat" | "manual";

const MODES: { id: Mode; label: string; Icon: typeof IconCamera }[] = [
  { id: "photo", label: "Chụp hoá đơn", Icon: IconCamera },
  { id: "chat", label: "Gõ một câu", Icon: IconChat },
  { id: "manual", label: "Nhập tay", Icon: IconPen },
];

export default function AddBill({
  user,
  groups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<Mode>("photo");
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  // Chụp hoá đơn
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrResult["items"]>([]);

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [bubbles, setBubbles] = useState<{ who: "me" | "ai"; text: string }[]>([]);

  useEffect(() => setGroup(resolveGroup(groups)), [groups]);

  const loadMembers = useCallback(async () => {
    if (!group) return;
    try {
      const res = await apiJson<{ members: Member[] }>(
        `/api/groups/${group.id}/members`
      );
      setMembers(res.members);
      setDraft(emptyDraft(res.members, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thành viên.");
    }
  }, [group, user.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function runOcr(file: File) {
    if (!group || !draft) return;
    setError("");
    setSaved("");
    setOcrBusy(true);
    setOcrItems([]);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const form = new FormData();
      form.set("groupId", String(group.id));
      form.set("image", file);
      const res = await apiJson<{ result: OcrResult }>("/api/ai/ocr", {
        method: "POST",
        body: form,
      });
      const r = res.result;
      setOcrItems(r.items);
      setDraft({
        ...draft,
        title: r.title,
        category: r.category,
        totalText: String(r.total),
        spentOn: r.spentOn,
        note: r.note,
      });
      if (r.total === 0)
        setError(
          "Mình đọc được ảnh nhưng chưa thấy tổng tiền. Bạn nhập tổng tiền bên dưới giúp."
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được hoá đơn.");
    } finally {
      setOcrBusy(false);
    }
  }

  async function runChat() {
    if (!group || !draft || !chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput("");
    setError("");
    setSaved("");
    setBubbles((b) => [...b, { who: "me", text: message }]);
    setChatBusy(true);

    try {
      const res = await apiJson<{ draft: ChatDraft }>("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: group.id, message }),
      });
      const d = res.draft;

      const selected: Record<number, boolean> = {};
      const exact: Record<number, string> = {};
      const weights: Record<number, number> = {};
      for (const m of members) {
        selected[m.userId] = false;
        exact[m.userId] = "";
        weights[m.userId] = 1;
      }
      for (const s of d.shares) {
        selected[s.userId] = true;
        exact[s.userId] = String(s.amount);
        weights[s.userId] = s.weight;
      }

      setDraft({
        ...draft,
        title: d.title,
        category: d.category,
        totalText: String(d.total),
        paidBy: d.paidBy,
        spentOn: d.spentOn,
        note: d.note,
        splitMode: d.splitMode,
        selected,
        weights,
        exact,
      });

      const lines = d.shares
        .map((s) => `${s.name}: ${formatVnd(s.amount)}`)
        .join("\n");
      setBubbles((b) => [
        ...b,
        {
          who: "ai",
          text: `${d.title} — ${formatVnd(d.total)}\n${d.explanation}\n\n${lines}\n\nKiểm tra lại bên dưới rồi bấm Lưu bill nhé.`,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không hiểu được câu mô tả.";
      setBubbles((b) => [...b, { who: "ai", text: msg }]);
    } finally {
      setChatBusy(false);
    }
  }

  function resetToStart(msg: string) {
    setSaved(msg);
    setError("");
    setMode("photo");
    setDraft(emptyDraft(members, user.id));
    setBubbles([]);
    setOcrItems([]);
    setChatInput("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    if (fileRef.current) fileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!group || !draft) {
    return (
      <div className="shell">
        <header className="topbar">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand">Thêm bill</span>
        </header>
        <div className="card card-pad muted">Đang tải…</div>
      </div>
    );
  }

  // Manual thì form nhập chính là "thông tin bill" nên luôn hiện.
  // Photo/chat thì phải có nội dung do OCR/AI đọc ra rồi mới hiện phần review.
  const hasContent =
    mode === "manual" || draft.title.trim().length > 0 || draft.totalText.trim().length > 0;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand">Thêm bill</span>
        <span className="spacer" />
        <GroupPicker
          groups={groups}
          current={group}
          onChange={(g) => {
            rememberGroupId(g.id);
            setGroup(g);
          }}
        />
      </header>

      {/* Segmented control kiểu iOS: ba cách nhập loại trừ nhau */}
      <div
        className="segmented"
        role="group"
        aria-label="Cách nhập bill"
        style={{ marginBottom: 16 }}
      >
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="segment"
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id);
              setError("");
              setSaved("");
            }}
          >
            <Icon size={ICON_SIZE.sm} filled={mode === id} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {saved && (
        <p className="notice" style={{ marginBottom: 14 }} role="status">
          <IconOk size={ICON_SIZE.sm} />
          <span>{saved}</span>
        </p>
      )}

      {mode === "photo" && (
        <section className="section">
          <div className="card card-pad stack">
            <p className="muted" style={{ margin: 0 }}>
              Chụp hoặc chọn ảnh hoá đơn, AI sẽ đọc tổng tiền và danh sách món.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runOcr(f);
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => fileRef.current?.click()}
              disabled={ocrBusy}
            >
              {ocrBusy ? (
                <>
                  <IconSpinner size={ICON_SIZE.md} /> Đang đọc hoá đơn
                </>
              ) : (
                <>
                  <IconCamera size={ICON_SIZE.md} />
                  {previewUrl ? "Chọn ảnh khác" : "Chọn ảnh hoá đơn"}
                </>
              )}
            </button>

            {previewUrl && (
              <img src={previewUrl} alt="Ảnh hoá đơn đã chọn" className="thumb" />
            )}

            {ocrItems.length > 0 && (
              <div>
                <p className="section-title" style={{ marginBottom: 6 }}>
                  Món đọc được từ hoá đơn
                </p>
                {ocrItems.map((it, i) => (
                  <div className="split-row" key={i} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="muted">
                      {it.quantity > 1 ? `${it.quantity}× ` : ""}
                      {it.name}
                    </span>
                    <span className="num">{formatVnd(it.price)}</span>
                  </div>
                ))}
                <p className="hint" style={{ marginTop: 8 }}>
                  Danh sách món chỉ để bạn đối chiếu. Số tiền chia lấy theo tổng bill.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {mode === "chat" && (
        <section className="section">
          <div className="card card-pad">
            {bubbles.length === 0 ? (
              <div className="empty" style={{ padding: "18px 4px" }}>
                <p className="empty-title">Mô tả bằng một câu</p>
                <p className="muted" style={{ margin: 0 }}>
                  Ví dụ: “Tối qua lẩu 1tr2, mình ứng, chia đều cho Huy, Lan và
                  Trung” hoặc “Cà phê 180k, Lan trả, mình với Lan chia đều”.
                </p>
              </div>
            ) : (
              <div className="bubbles">
                {bubbles.map((b, i) => (
                  <div key={i} className={`bubble ${b.who}`}>
                    {b.text}
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ alignItems: "flex-end" }}>
              <textarea
                className="textarea"
                style={{ minHeight: 60 }}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runChat();
                  }
                }}
                placeholder="Ăn trưa 450k chia đều 3 người"
                aria-label="Mô tả khoản chi"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runChat()}
                disabled={chatBusy || !chatInput.trim()}
              >
                {chatBusy ? <IconSpinner size={ICON_SIZE.md} /> : "Gửi"}
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {hasContent && (
        <>
          <div className="section-head">
            <h2 className="section-title">
              {mode === "manual" ? "Thông tin bill" : "Kiểm tra rồi lưu"}
            </h2>
          </div>

          <BillForm
            groupId={group.id}
            members={members}
            currentUserId={user.id}
            draft={draft}
            setDraft={setDraft}
            source={mode === "photo" ? "ocr" : mode === "chat" ? "chat" : "manual"}
            onSaved={resetToStart}
          />
        </>
      )}
    </div>
  );
}
