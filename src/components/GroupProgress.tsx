"use client";

import { IconCheck } from "./Icons";
import type { GroupProgress as Progress } from "@/lib/gamification";

/**
 * Thẻ "Tiến độ nhóm" — 4 bước hoàn tất một chu kỳ chi tiêu.
 * Cộng tác, không chấm điểm cá nhân. Hiển thị "Nhóm · 3/4 bước hoàn tất".
 */
export default function GroupProgress({
  progress,
  groupName,
}: {
  progress: Progress;
  groupName?: string;
}) {
  const { steps, doneCount, total, complete } = progress;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div className={`card card-pad gp${complete ? " gp-complete" : ""}`}>
      <div className="gp-head">
        <span className="gp-title">Tiến độ nhóm</span>
        <span className="spacer" />
        <span className="gp-count num">
          {doneCount}/{total} bước
        </span>
      </div>
      {groupName && <p className="gp-sub faint tiny">{groupName}</p>}

      <div className="gp-track" aria-hidden="true">
        <div className="gp-track-fill" style={{ width: `${pct}%` }} />
      </div>

      <ul className="gp-steps">
        {steps.map((s) => (
          <li
            key={s.key}
            className={`gp-step${s.done ? " done" : ""}`}
            title={s.hint}
          >
            <span className="gp-dot">
              {s.done && <IconCheck size={13} />}
            </span>
            <span className="gp-step-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <p className="gp-hint faint tiny">
        {complete
          ? "Sổ nhóm đã gọn gàng — cả nhóm hoàn tất kỳ này 🎉"
          : steps.find((s) => !s.done)?.hint}
      </p>
    </div>
  );
}
