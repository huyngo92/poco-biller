"use client";

import { useState, useEffect, useCallback } from "react";
import { apiJson } from "@/lib/client";
import { IconAlert, IconBell, IconCalendar, IconCheck, IconChevron, IconSpinner, ICON_SIZE } from "@/components/Icons";
import GroupPicker from "@/components/GroupPicker";

type ScheduledPush = {
  id: number;
  title: string;
  body: string;
  targetType: "all" | "group";
  targetId: number | null;
  sendAt: string;
  status: "pending" | "sent" | "failed";
};

export default function NotificationCenter({
  groups,
  onRefresh,
}: {
  groups: any[];
  onRefresh: () => void;
}) {
  const [scheduled, setScheduled] = useState<ScheduledPush[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "group">("all");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [sendAt, setSendAt] = useState("");
  const [isSending, setIsSending] = useState(false);

  const loadScheduled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiJson<{ scheduled: ScheduledPush[] }>( "/api/admin/push");
      setScheduled(res.scheduled);
    } catch (e) {
      setError("Không tải được danh sách hẹn giờ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  async function handleSend() {
    if (!title || !body) {
      setError("Vui lòng nhập tiêu đề và nội dung.");
      return;
    }
    setIsSending(true);
    setError("");
    try {
      await apiJson("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          body,
          targetType,
          targetId,
          sendAt: sendAt || null,
        }),
      });
      setTitle("");
      setBody("");
      setSendAt("");
      void loadScheduled();
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gửi thông báo thất bại.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Soạn thông báo</h2>
        </div>
        <div className="card card-pad stack">
          <div className="field">
            <label className="label">Tiêu đề</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ví dụ: Thông báo chốt sổ tháng 9"
            />
          </div>
          <div className="field">
            <label className="label">Nội dung</label>
            <textarea
              className="input"
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Nhập nội dung thông báo..."
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="field">
            <label className="label">Đối tượng nhận</label>
            <div className="segmented" role="group">
              <button
                type="button"
                className="segment"
                aria-pressed={targetType === "all"}
                onClick={() => { setTargetType("all"); setTargetId(null); }}
              >
                Tất cả User
              </button>
              <button
                type="button"
                className="segment"
                aria-pressed={targetType === "group"}
                onClick={() => setTargetType("group")}
              >
                Theo nhóm
              </button>
            </div>
            {targetType === "group" && (
              <div style={{ marginTop: 12 }}>
                <GroupPicker
                  groups={groups}
                  current={groups.find(g => g.id === targetId)}
                  onChange={g => setTargetId(g.id)}
                />
              </div>
            )}
          </div>
          <div className="field">
            <label className="label">Thời gian gửi (để trống để gửi ngay)</label>
            <div className="row" style={{ alignItems: "center", gap: 8 }}>
              <input
                type="datetime-local"
                className="input"
                value={sendAt}
                onChange={e => setSendAt(e.target.value)}
              />
              <IconCalendar size={ICON_SIZE.sm} className="faint" />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={isSending}
            onClick={handleSend}
          >
            {isSending ? <IconSpinner size={ICON_SIZE.sm} /> : <IconBell size={ICON_SIZE.sm} />}
            {sendAt ? "Hẹn giờ gửi" : "Gửi tức thì"}
          </button>
          {error && <p className="error" style={{ marginTop: 8 }} role="alert"><IconAlert size={ICON_SIZE.sm} /> {error}</p>}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Lịch gửi thông báo</h2>
        </div>
        <div className="card">
          {loading ? (
            <div style={{ padding: 20, textAlign: "center" }}><IconSpinner size={24} /></div>
          ) : scheduled.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--label-tertiary)" }}>
              Không có thông báo nào đang chờ gửi.
            </div>
          ) : (
            <ul className="ledger">
              {scheduled.map(n => (
                <li key={n.id} className="list-row">
                  <div className="list-row-main">
                    <strong style={{ display: "block" }}>{n.title}</strong>
                    <span className="faint tiny" style={{ display: "block" }}>
                      {n.targetType === "all" ? "Toàn bộ user" : `Nhóm ID: ${n.targetId}`} • {n.sendAt}
                    </span>
                  </div>
                  <span className={`tag ${n.status === 'pending' ? 'tag-blue' : 'tag-green'}`}>
                    {n.status === 'pending' ? 'Chờ gửi' : 'Đã gửi'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}