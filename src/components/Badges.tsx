"use client";

import type { Badge } from "@/lib/gamification";

/** Emoji đại diện cho từng huy hiệu (phi tiền tệ, vui mắt). */
const BADGE_EMOJI: Record<string, string> = {
  "bill-ro-rang": "🧾",
  "chia-deu-dep": "🤝",
  "qr-cuu-nguy": "⚡",
  "nguoi-to-chuc-tot": "⭐",
  "thang-minh-bach": "📊",
};

/**
 * Lưới huy hiệu cộng tác. Huy hiệu chưa đạt hiển thị mờ + nêu cách nhận
 * (minh bạch: mỗi huy hiệu giải thích được vì sao).
 */
export default function Badges({
  badges,
  showLocked = true,
}: {
  badges: Badge[];
  showLocked?: boolean;
}) {
  const list = showLocked ? badges : badges.filter((b) => b.earned);
  if (list.length === 0) return null;

  return (
    <div className="badges-grid">
      {list.map((b) => (
        <div
          key={b.id}
          className={`badge${b.earned ? " earned" : ""}`}
          title={b.reason}
        >
          <span className="badge-ic" aria-hidden="true">
            {BADGE_EMOJI[b.id] ?? "🏅"}
          </span>
          <span className="badge-name">{b.label}</span>
          <span className="badge-why faint tiny">{b.reason}</span>
        </div>
      ))}
    </div>
  );
}
