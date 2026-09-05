"use client";

import { useCallback, useEffect, useState } from "react";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { IconAlert, IconBell, IconOk, IconSpinner, ICON_SIZE } from "./Icons";

/** Toggle bật/tắt push notification trong phần Cài đặt. */
export default function NotificationSettings() {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const showForeground = useCallback((title: string, body: string) => {
    // Browser đã cấp quyền thì hiển thị notification native khi tab đang mở.
    if (Notification.permission === "granted") new Notification(title, { body });
  }, []);
  const { status, enabled, enable } = usePushNotifications(showForeground);

  useEffect(() => {
    if (status === "granted") setNotice("Thông báo đã được bật trên thiết bị này.");
    if (status === "denied") setError("Bạn đã chặn thông báo. Hãy cho phép trong cài đặt trình duyệt.");
  }, [status]);

  async function handleEnable() {
    setError("");
    setNotice("");
    const ok = await enable();
    if (!ok && status !== "denied")
      setError("Không thể bật thông báo. Hãy kiểm tra trình duyệt và cấu hình Firebase.");
  }

  if (status === "unsupported") {
    return (
      <div className="list-row" style={{ opacity: 0.65, cursor: "default" }}>
        <span className="list-row-icon"><IconBell size={ICON_SIZE.md} /></span>
        <span className="list-row-main">
          Thông báo đẩy
          <span className="faint" style={{ display: "block", fontWeight: 400 }}>
            Trình duyệt này chưa hỗ trợ
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="card-pad stack" style={{ borderTop: "1px solid var(--rule)" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="list-row-icon"><IconBell size={ICON_SIZE.md} /></span>
          <span className="list-row-main">
            Thông báo đẩy
            <span className="faint" style={{ display: "block", fontWeight: 400 }}>
              {enabled ? "Đang bật trên thiết bị này" : "Nhận tin khi nhóm có hoạt động mới"}
            </span>
          </span>
        </div>

        <div
          className={`toggle ${enabled ? "active" : ""}`}
          onClick={() => void handleEnable()}
          style={{
            cursor: "pointer",
            // Inline styles for toggle if CSS is not yet updated
            display: "inline-flex",
            alignItems: "center",
            width: 44,
            height: 24,
            backgroundColor: enabled ? "var(--tint-strong)" : "var(--fill-quaternary)",
            borderRadius: 12,
            position: "relative",
            transition: "background-color 0.2s"
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            backgroundColor: "white",
            borderRadius: "50%",
            position: "absolute",
            left: enabled ? 22 : 2,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }} />
        </div>
      </div>
      {notice && <p className="notice" role="status"><IconOk size={ICON_SIZE.sm} />{notice}</p>}
      {error && <p className="error" role="alert"><IconAlert size={ICON_SIZE.sm} />{error}</p>}
    </div>
  );
}