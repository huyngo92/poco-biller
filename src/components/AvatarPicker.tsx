"use client";

import { AVATARS, randomAvatar } from "@/lib/avatars";
import Avatar from "./Avatar";

/**
 * Lưới chọn avatar — giống Splitwise.
 * Hiện tất cả preset, highlight cái đang chọn, có nút random.
 */
export default function AvatarPicker({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="avatar-picker">
      <div className="avatar-grid" role="radiogroup" aria-label="Chọn avatar">
        {AVATARS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`avatar-option${current === a.id ? " selected" : ""}`}
            aria-pressed={current === a.id}
            aria-label={a.label}
            onClick={() => onSelect(a.id)}
          >
            <Avatar avatarId={a.id} name={a.label} size={48} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => onSelect(randomAvatar().id)}
        style={{ alignSelf: "center", marginTop: 4 }}
      >
        🎲 Ngẫu nhiên
      </button>
    </div>
  );
}
