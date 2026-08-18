"use client";

import { useState } from "react";
import { getAvatar, initials } from "@/lib/avatars";

/**
 * Hiển thị avatar người dùng — ảnh minh hoạ tròn, fallback về chữ cái đầu
 * (khi chưa chọn avatar hoặc ảnh lỗi). size: đường kính (px), mặc định 40.
 */
export default function Avatar({
  avatarId,
  name,
  size = 40,
  className,
}: {
  avatarId?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const preset = avatarId ? getAvatar(avatarId) : undefined;
  const [broken, setBroken] = useState(false);

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    userSelect: "none",
    overflow: "hidden",
  };

  if (preset && !broken) {
    return (
      <span className={className} aria-hidden="true" style={base}>
        {/* Ảnh sprite đã cắt sẵn nền trong suốt; dùng <img> thường để không
            phụ thuộc next/image (tránh cấu hình loader). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preset.src}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        ...base,
        background: "var(--fill-tertiary)",
        color: "var(--label)",
        fontSize: size * 0.44,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </span>
  );
}
