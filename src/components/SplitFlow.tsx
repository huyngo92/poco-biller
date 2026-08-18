"use client";

import Avatar from "./Avatar";
import { formatShort } from "@/lib/money";

export type FlowPerson = {
  userId: number;
  name: string;
  avatar?: string;
  amount: number;
  /** Có đang tham gia chia hay không — chỉ dùng khi `onTogglePerson` được truyền. */
  selected?: boolean;
};

/**
 * Sơ đồ dòng tiền: người ứng → những người chia. Mỗi người hiển thị avatar +
 * phần phải chịu. Làm "cách chia tiền" trực quan như mô tả trong gamification.
 *
 * Khi có `onTogglePerson`, avatar bấm được để bật/tắt tham gia chia — dùng ở
 * bước "Chia tiền" của wizard thay cho hàng checkbox.
 */
export default function SplitFlow({
  payerName,
  payerAvatar,
  total,
  people,
  onTogglePerson,
}: {
  payerName: string;
  payerAvatar?: string;
  total: number;
  people: FlowPerson[];
  onTogglePerson?: (userId: number) => void;
}) {
  const activeCount = people.filter((p) => p.selected !== false).length;

  return (
    <div className="flow">
      <div className="flow-payer">
        <Avatar avatarId={payerAvatar} name={payerName} size={40} />
        <span className="flow-payer-text">
          <b>{payerName}</b> đã ứng
          <span className="num flow-total"> {formatShort(total)}</span>
        </span>
      </div>

      <div className="flow-line" aria-hidden="true">
        <span className="flow-line-label">
          {activeCount} người · {formatShort(Math.round(total / Math.max(1, activeCount)))}/người
        </span>
      </div>

      <div className="flow-people">
        {people.map((p) => {
          const on = p.selected !== false;
          const content = (
            <>
              <Avatar avatarId={p.avatar} name={p.name} size={38} />
              <span className="flow-person-name">{p.name}</span>
              <span className="num flow-amount">{on ? formatShort(p.amount) : "—"}</span>
            </>
          );
          return onTogglePerson ? (
            <button
              type="button"
              key={p.userId}
              className="flow-person"
              style={{
                opacity: on ? 1 : 0.4,
                background: "none",
                border: "none",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
              }}
              aria-pressed={on}
              aria-label={`${on ? "Bỏ" : "Thêm"} ${p.name} khỏi lần chia này`}
              onClick={() => onTogglePerson(p.userId)}
            >
              {content}
            </button>
          ) : (
            <div className="flow-person" key={p.userId}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
