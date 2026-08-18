"use client";

import Mascot from "./Mascot";

/**
 * Thẻ ăn mừng khi khép kỳ — dùng ở màn Nhắc nợ khi nhóm sạch nợ.
 * Ăn mừng nhẹ, tôn trọng ngữ cảnh tiền bạc (chỉ khi hoàn tất, không khi phát sinh nợ).
 */
export default function Celebration({
  title = "Kỳ này đã khép lại",
  subtitle = "Sổ nhóm thật gọn.",
  billCount,
  memberCount,
  pending = 0,
  actions,
}: {
  title?: string;
  subtitle?: string;
  billCount?: number;
  memberCount?: number;
  pending?: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="card card-pad celebrate">
      <Mascot name="done" size={112} />
      <p className="celebrate-title">{title}</p>
      {billCount != null && memberCount != null && (
        <p className="celebrate-stats num">
          {billCount} khoản · {memberCount} thành viên · {pending} khoản đang chờ
        </p>
      )}
      <p className="faint tiny" style={{ margin: 0 }}>
        {subtitle}
      </p>
      {actions && <div className="celebrate-actions">{actions}</div>}
    </div>
  );
}
