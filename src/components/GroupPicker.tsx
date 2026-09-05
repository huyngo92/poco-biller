"use client";

import { rememberGroupId } from "@/lib/client";
import type { Group } from "@/lib/types";

export default function GroupPicker({
  groups,
  current,
  onChange,
}: {
  groups: Group[];
  current: Group | null;
  onChange: (group: Group) => void;
}) {
  if (!current) return null;
  if (groups.length <= 1) {
    return <span className="faint">{current.name}</span>;
  }

  return (
    <label className="row" style={{ gap: 6 }}>
      {/* Nhãn phải ở lại cho screen reader, display:none sẽ làm select mất tên */}
      <span className="visually-hidden">Chọn nhóm</span>
      <select
        className="select"
        style={{ width: "auto", minHeight: 34, padding: "0 30px 0 10px", fontSize: 15 }}
        value={current.id}
        onChange={(e) => {
          const g = groups.find((x) => x.id === Number(e.target.value));
          if (!g) return;
          rememberGroupId(g.id);
          onChange(g);
        }}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}
