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
      <div className="row">
        <span className="list-row-icon"><IconBell size={ICON_SIZE.md} /></span>
        <span className="list-row-main">
          Thông báo đẩy
          <span className="faint" style={{ display: "block", fontWeight: 400 }}>
            {enabled ? "Đang bật trên thiết bị này" : "Nhận tin khi nhóm có hoạt động mới"}
          </span>
        </span>
        {enabled ? (
          <span className="tag tag-blue"><IconOk size={14} /> Đã bật</span>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleEnable()}>
            {status === "loading" ? <IconSpinner size={ICON_SIZE.sm} /> : "Bật"}
          </button>
        )}
      </div>
      {notice && <p className="notice" role="status"><IconOk size={ICON_SIZE.sm} />{notice}</p>}
      {error && <p className="error" role="alert"><IconAlert size={ICON_SIZE.sm} />{error}</p>}
    </div>
  );
}