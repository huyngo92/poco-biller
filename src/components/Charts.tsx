"use client";

/**
 * Bốn chart nhỏ cho dashboard, vẽ bằng SVG tay — không thêm dependency nào.
 *
 * Quy ước chung theo Apple HIG và WCAG:
 * - Chart chỉ là lớp trực quan. Mọi con số đều có mặt dưới dạng chữ (legend,
 *   nhãn cột, dòng tóm tắt) nên người không phân biệt được màu vẫn đọc đủ.
 * - SVG trang trí thì `aria-hidden`; phần chữ bên cạnh mới là nội dung thật.
 * - Không animation lúc mount: dashboard tải lại mỗi lần đổi kỳ, chart nhảy
 *   liên tục sẽ gây nhiễu. Chỉ transition khi giá trị đổi, và tôn trọng
 *   prefers-reduced-motion (khai báo ở globals.css).
 */

import { formatShort, formatVnd } from "@/lib/money";
import {
  dailyBuckets,
  donutSlices,
  pctChange,
  sparkPoints,
  type Bucket,
} from "@/lib/chart";
import type { Balance, Bill } from "@/lib/types";
import type { TrendPoint } from "@/lib/client";

/* ========================================================================
   1. Donut phân bổ hạng mục
   ===================================================================== */

const DONUT_SIZE = 132;

export function CategoryDonut({
  data,
  total,
}: {
  data: { category: string; amount: number }[];
  total: number;
}) {
  // Quá 5 hạng mục thì legend dài hơn cả chart — dồn phần đuôi vào "Khác"
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((a, b) => a + b.amount, 0);
  const shown =
    rest > 0 ? [...top, { category: "khac", amount: rest }] : top;

  const slices = donutSlices(shown, { size: DONUT_SIZE, thickness: 24 });

  if (slices.length === 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Chưa có bill nào để chia hạng mục.
      </p>
    );

  return (
    <div className="donut-wrap">
      <div className="donut-fig">
        <svg
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          aria-hidden="true"
          focusable="false"
        >
          {slices.map((s) => (
            <path key={s.key} d={s.d} fill={s.color} />
          ))}
        </svg>
        {/* Tổng nằm giữa lỗ donut — đặt bằng HTML thay vì <text> để dùng
            đúng font và thang chữ của app */}
        <div className="donut-center" aria-hidden="true">
          <span className="donut-center-value num">{formatShort(total)}</span>
          <span className="donut-center-label">tổng chi</span>
        </div>
      </div>

      <ul className="legend">
        {slices.map((s) => (
          <li key={s.key}>
            <span
              className="legend-dot"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value num">
              {s.percent}% · {formatShort(s.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================================================================
   2. Cột chi tiêu theo ngày / tuần
   ===================================================================== */

export function SpendBars({
  bills,
  from,
  to,
}: {
  bills: Pick<Bill, "spentOn" | "total">[];
  from: string;
  to: string;
}) {
  // Kỳ "Tất cả" trải từ năm 0000 đến 9999 — bó lại đúng khoảng có bill thật,
  // nếu không dailyBuckets sẽ đếm hàng triệu ngày.
  const dates = bills.map((b) => b.spentOn).sort();
  const lo = dates.length > 0 && from < dates[0] ? dates[0] : from;
  const hi =
    dates.length > 0 && to > dates[dates.length - 1]
      ? dates[dates.length - 1]
      : to;

  const { buckets, unitLabel } = dailyBuckets(bills, lo, hi);
  const withMoney = buckets.filter((b) => b.amount > 0);

  if (withMoney.length === 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Kỳ này chưa có khoản chi nào.
      </p>
    );

  const max = Math.max(...buckets.map((b) => b.amount));
  // Trung bình tính trên ngày có chi, không phải mọi ngày — con số mới có nghĩa
  const avg = Math.round(
    withMoney.reduce((a, b) => a + b.amount, 0) / withMoney.length
  );
  const avgPct = (avg / max) * 100;
  const peak = buckets.reduce((m, b) => (b.amount > m.amount ? b : m), buckets[0]);

  // Nhiều cột thì chỉ ghi nhãn thưa cho khỏi chữ đè lên nhau
  const labelEvery = buckets.length > 16 ? 5 : buckets.length > 10 ? 3 : 1;
  const lastIdx = buckets.length - 1;

  /**
   * Luôn ghi nhãn cột cuối để biết kỳ kết thúc ở đâu — nhưng chỉ khi nó cách
   * nhãn thưa gần nhất đủ xa, nếu không hai nhãn sẽ đè lên nhau.
   */
  const showLabel = (i: number) => {
    if (i !== lastIdx) return i % labelEvery === 0;
    const gap = lastIdx % labelEvery; // khoảng cách tới nhãn thưa gần nhất
    return gap === 0 || gap >= Math.ceil(labelEvery / 2);
  };

  return (
    <div>
      <div className="bars" aria-hidden="true">
        {/* Vạch trung bình: cho biết cột nào là bất thường */}
        <div className="bars-avg" style={{ bottom: `${avgPct}%` }} />
        {buckets.map((b: Bucket, i) => (
          <div className="bar-col" key={b.key}>
            <div
              className={`bar${
                b.amount === 0
                  ? " zero"
                  : b.amount === max && max > 0
                    ? " peak"
                    : ""
              }`}
              style={{ height: `${max > 0 ? (b.amount / max) * 100 : 0}%` }}
            />
            <span className="bar-label">
              {showLabel(i) ? b.label : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="chart-note">
        Cao nhất là mốc {peak.label} với {formatVnd(peak.amount)}. Trung bình
        mỗi {unitLabel} có chi là {formatVnd(avg)}.
      </p>
    </div>
  );
}

/* ========================================================================
   3. Ai ứng nhiều nhất
   ===================================================================== */

export function PaidRanking({
  balances,
  currentUserId,
}: {
  balances: Balance[];
  currentUserId: number;
}) {
  const ranked = balances
    .filter((b) => b.paid > 0)
    .sort((a, b) => b.paid - a.paid);

  if (ranked.length === 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Chưa ai ứng tiền trong kỳ này.
      </p>
    );

  const max = ranked[0].paid;
  const total = ranked.reduce((a, b) => a + b.paid, 0);

  return (
    <ul className="rank">
      {ranked.map((b, i) => (
        <li key={b.userId}>
          <span className="rank-num num" aria-hidden="true">
            {i + 1}
          </span>
          <span className="rank-body">
            <span className="rank-head">
              <span className="rank-name">
                {b.name}
                {b.userId === currentUserId && (
                  <span className="tag tag-blue" style={{ marginLeft: 6 }}>
                    Bạn
                  </span>
                )}
              </span>
              <span className="rank-value num">{formatShort(b.paid)}</span>
            </span>
            <span className="rank-track" aria-hidden="true">
              <span
                className="rank-fill"
                style={{ width: `${(b.paid / max) * 100}%` }}
              />
            </span>
            <span className="faint tiny">
              {Math.round((b.paid / total) * 100)}% số tiền nhóm đã ứng
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================
   4. So với kỳ trước — sparkline
   ===================================================================== */

const SPARK_W = 260;
const SPARK_H = 44;
/** Lề để nét 2px ở hai đầu đường không bị mép SVG cắt mất một nửa. */
const SPARK_PAD = 4;

export function TrendSpark({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Cần ít nhất hai kỳ để so sánh xu hướng.
      </p>
    );

  const values = trend.map((t) => t.amount);
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  const change = pctChange(current, previous);
  const pts = sparkPoints(values, SPARK_W, SPARK_H, SPARK_PAD);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  // Vùng tô đóng xuống đáy, khép về đúng x của điểm đầu để không lệch sang lề
  const area = `${line} L ${last.x} ${SPARK_H} L ${first.x} ${SPARK_H} Z`;

  // Chi nhiều hơn kỳ trước là tín hiệu cần để ý → dùng màu đỏ, và kèm dấu
  // +/- để không phụ thuộc vào màu
  const tone = change === null ? "" : change > 0 ? "debt" : change < 0 ? "credit" : "";

  return (
    <div>
      <p className={`trend-head num ${tone}`}>
        {change === null
          ? "Kỳ trước chưa có chi tiêu để so"
          : change === 0
            ? "Bằng đúng kỳ trước"
            : `${change > 0 ? "+" : "−"}${Math.abs(change)}% so với kỳ trước`}
      </p>

      <svg
        className="spark"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path className="spark-area" d={area} />
        <path className="spark-line" d={line} />
        {/* preserveAspectRatio="none" kéo giãn ngang nên hình tròn sẽ bị méo
            — dùng vạch dọc để đánh dấu kỳ hiện tại */}
        <line
          className="spark-now"
          x1={last.x}
          y1={Math.max(0, last.y - 5)}
          x2={last.x}
          y2={Math.min(SPARK_H, last.y + 5)}
        />
      </svg>

      <ul className="spark-scale" aria-hidden="true">
        {trend.map((t, i) => (
          <li key={t.from} className={i === trend.length - 1 ? "now" : ""}>
            {t.label}
          </li>
        ))}
      </ul>

      <p className="chart-note">
        {trend
          .map((t) => `${t.label}: ${formatShort(t.amount)}`)
          .join(" · ")}
      </p>
    </div>
  );
}
