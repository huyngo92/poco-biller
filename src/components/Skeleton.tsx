import type { CSSProperties } from "react";

export function Skeleton({
  width,
  height = 14,
  radius,
  inline = false,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  inline?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{
        display: inline ? "inline-block" : "block",
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** Dãy dòng ledger giả — khớp layout .entry (icon tròn + 2 dòng + số tiền). */
export function SkeletonLedgerRows({ count = 3 }: { count?: number }) {
  return (
    <ul className="ledger" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="entry" style={{ cursor: "default" }}>
            <Skeleton width={40} height={40} radius="50%" style={{ flexShrink: 0 }} />
            <span className="entry-main">
              <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="35%" height={11} />
            </span>
            <Skeleton width={48} height={16} />
          </div>
        </li>
      ))}
    </ul>
  );
}
