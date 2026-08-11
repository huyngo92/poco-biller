"use client";

import { getAvatar, initials } from "@/lib/avatars";

/**
 * Hiển thị avatar người dùng — hình tròn với emoji hoặc chữ cái đầu.
 * size: đường kính (px). Mặc định 40.
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
  const fontSize = preset ? size * 0.52 : size * 0.44;

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: preset?.bg ?? "var(--fill-tertiary)",
        color: preset ? "#fff" : "var(--label)",
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
        userSelect: "none",
        textShadow: preset ? "0 1px 2px rgba(0,0,0,0.15)" : "none",
      }}
    >
      {preset ? preset.emoji : initials(name)}
    </span>
  );
}
