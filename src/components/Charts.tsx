"use client";

/**
 * Hai chart dashboard, viết bằng Visx (SVG primitives của Airbnb).
 *
 * Quy ước chung theo Apple HIG và WCAG:
 * - Chart chỉ là lớp trực quan. Mọi con số đều có mặt dưới dạng chữ (legend,
 *   nhãn kỳ, dòng tóm tắt) nên người không phân biệt được màu vẫn đọc đủ.
 * - SVG trang trí thì `aria-hidden`; phần chữ bên cạnh mới là nội dung thật.
 * - Tooltip là lớp bổ sung; khi hover không có, thông tin vẫn đầy đủ qua text.
 * - Tôn trọng prefers-reduced-motion (hover scale effect tắt qua CSS).
 */

import { useState, useCallback } from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { AreaClosed, LinePath } from "@visx/shape";
import { scaleLinear } from "@visx/scale";
import { curveMonotoneX } from "@visx/curve";
import { useTooltip, useTooltipInPortal, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { formatShort, formatVnd } from "@/lib/money";
import { categoryColor, donutPercents, pctChange } from "@/lib/chart";
import type { Balance, Bill } from "@/lib/types";
import type { TrendPoint } from "@/lib/client";

/* ========================================================================
   1. Donut phân bổ hạng mục
   ===================================================================== */

const DONUT_SIZE = 132;
const DONUT_OUTER = DONUT_SIZE / 2;
const DONUT_INNER = DONUT_OUTER - 24;
const PAD_ANGLE = 0.025; // khoảng cách giữa các cung (radian)

type DonutDatum = { category: string; amount: number };

export function CategoryDonut({
  data,
  total,
}: {
  data: DonutDatum[];
  total: number;
}) {
  // Quá 5 hạng mục thì legend dài hơn cả chart — dồn phần đuôi vào "Khác"
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((a, b) => a + b.amount, 0);
  const shown: DonutDatum[] =
    rest > 0 ? [...top, { category: "khac", amount: rest }] : top;

  const percents = donutPercents(shown);

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<DonutDatum & { percent: number }>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (shown.length === 0 || total <= 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Chưa có bill nào để chia hạng mục.
      </p>
    );

  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;

  return (
    <div className="donut-wrap">
      <div className="donut-fig" ref={containerRef}>
        <svg
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          aria-hidden="true"
          focusable="false"
        >
          <Group top={cy} left={cx}>
            <Pie
              data={shown}
              pieValue={(d) => d.amount}
              outerRadius={(arc) =>
                hoveredIndex === arc.index
                  ? DONUT_OUTER
                  : DONUT_OUTER - 2
              }
              innerRadius={DONUT_INNER}
              padAngle={PAD_ANGLE}
            >
              {(pie) =>
                pie.arcs.map((arc, i) => {
                  const color = categoryColor(arc.data.category);
                  const pct = percents[i]?.percent ?? 0;
                  return (
                    <path
                      key={arc.data.category}
                      d={pie.path(arc) ?? ""}
                      fill={color}
                      style={{
                        cursor: "default",
                        transition: "d 120ms ease, opacity 120ms ease",
                        opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.55 : 1,
                      }}
                      onMouseMove={(e) => {
                        const pt = localPoint(e) ?? { x: 0, y: 0 };
                        setHoveredIndex(i);
                        showTooltip({
                          tooltipLeft: pt.x + cx,
                          tooltipTop: pt.y + cy,
                          tooltipData: { ...arc.data, percent: pct },
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredIndex(null);
                        hideTooltip();
                      }}
                    />
                  );
                })
              }
            </Pie>
          </Group>
        </svg>

        {/* Tổng nằm giữa lỗ donut */}
        <div className="donut-center" aria-hidden="true">
          <span className="donut-center-value num">{formatShort(total)}</span>
          <span className="donut-center-label">tổng chi</span>
        </div>

        {tooltipOpen && tooltipData && (
          <TooltipInPortal
            top={tooltipTop}
            left={tooltipLeft}
            className="chart-tooltip"
          >
            <span className="chart-tooltip-label">{tooltipData.category === "khac" ? "Khác" : tooltipData.category}</span>
            <span className="chart-tooltip-value num">{formatVnd(tooltipData.amount)}</span>
            <span className="chart-tooltip-sub">{tooltipData.percent}%</span>
          </TooltipInPortal>
        )}
      </div>

      <ul className="legend">
        {shown.map((d, i) => {
          const pct = percents[i]?.percent ?? 0;
          return (
            <li key={d.category}>
              <span
                className="legend-dot"
                style={{ background: categoryColor(d.category) }}
                aria-hidden="true"
              />
              <span className="legend-label">{d.category === "khac" ? "Khác" : d.category}</span>
              <span className="legend-value num">
                {pct}% · {formatShort(d.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ========================================================================
   2. Pie số dư từng người — mỗi lát một người, đỏ = đang nợ, xanh = được nhận
   ===================================================================== */

const BAL_SIZE = 132;
const BAL_OUTER = BAL_SIZE / 2;
const BAL_INNER = BAL_OUTER - 24;

type BalanceArc = Balance & { share: number };

export function BalancePie({ balances }: { balances: Balance[] }) {
  const shown = balances.filter((b) => b.net !== 0);
  const totalImbalance = shown.reduce(
    (a, b) => a + (b.net > 0 ? b.net : 0),
    0
  );

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<Balance>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (shown.length === 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        Cả nhóm đã cân bằng, không ai nợ ai.
      </p>
    );

  const cx = BAL_SIZE / 2;
  const cy = BAL_SIZE / 2;

  return (
    <div className="donut-wrap">
      <div className="donut-fig" ref={containerRef}>
        <svg
          viewBox={`0 0 ${BAL_SIZE} ${BAL_SIZE}`}
          width={BAL_SIZE}
          height={BAL_SIZE}
          aria-hidden="true"
          focusable="false"
        >
          <Group top={cy} left={cx}>
            <Pie
              data={shown}
              pieValue={(d) => Math.abs(d.net)}
              outerRadius={(arc) =>
                hoveredIndex === arc.index ? BAL_OUTER : BAL_OUTER - 2
              }
              innerRadius={BAL_INNER}
              padAngle={PAD_ANGLE}
            >
              {(pie) =>
                pie.arcs.map((arc, i) => {
                  const color =
                    arc.data.net < 0 ? "var(--debt)" : "var(--credit)";
                  return (
                    <path
                      key={arc.data.userId}
                      d={pie.path(arc) ?? ""}
                      fill={color}
                      style={{
                        cursor: "default",
                        transition: "d 120ms ease, opacity 120ms ease",
                        opacity:
                          hoveredIndex !== null && hoveredIndex !== i
                            ? 0.55
                            : 1,
                      }}
                      onMouseMove={(e) => {
                        const pt = localPoint(e) ?? { x: 0, y: 0 };
                        setHoveredIndex(i);
                        showTooltip({
                          tooltipLeft: pt.x + cx,
                          tooltipTop: pt.y + cy,
                          tooltipData: arc.data,
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredIndex(null);
                        hideTooltip();
                      }}
                    />
                  );
                })
              }
            </Pie>
          </Group>
        </svg>

        <div className="donut-center" aria-hidden="true">
          <span className="donut-center-value num">
            {formatShort(totalImbalance)}
          </span>
          <span className="donut-center-label">chưa cân bằng</span>
        </div>

        {tooltipOpen && tooltipData && (
          <TooltipInPortal
            top={tooltipTop}
            left={tooltipLeft}
            className="chart-tooltip"
          >
            <span className="chart-tooltip-label">{tooltipData.name}</span>
            <span
              className={`chart-tooltip-value num ${
                tooltipData.net < 0 ? "debt" : "credit"
              }`}
            >
              {tooltipData.net < 0
                ? `nợ ${formatVnd(-tooltipData.net)}`
                : `nhận ${formatVnd(tooltipData.net)}`}
            </span>
          </TooltipInPortal>
        )}
      </div>
    </div>
  );
}

/* ========================================================================
   3. Sparkline xu hướng chi tiêu
   ===================================================================== */

const SPARK_W = 260;
const SPARK_H = 44;
const SPARK_PAD = 4;

export function TrendSpark({ trend }: { trend: TrendPoint[] }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<TrendPoint & { x: number }>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  });

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
  const tone =
    change === null ? "" : change > 0 ? "debt" : change < 0 ? "credit" : "";

  const maxVal = Math.max(...values, 1);

  const xScale = scaleLinear({
    domain: [0, trend.length - 1],
    range: [SPARK_PAD, SPARK_W - SPARK_PAD],
  });

  const yScale = scaleLinear({
    domain: [0, maxVal],
    range: [SPARK_H - SPARK_PAD, SPARK_PAD],
  });

  // Điểm đang hiện vạch dọc: hover idx hoặc điểm cuối
  const markerIdx = hoverIdx !== null ? hoverIdx : trend.length - 1;
  const markerX = xScale(markerIdx);
  const markerY = yScale(values[markerIdx]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const pt = localPoint(e);
      if (!pt) return;
      // Tìm điểm gần nhất theo trục x
      const xVal = xScale.invert(pt.x);
      const idx = Math.min(
        trend.length - 1,
        Math.max(0, Math.round(xVal))
      );
      const tx = xScale(idx);
      setHoverIdx(idx);
      showTooltip({
        tooltipLeft: tx,
        tooltipTop: yScale(values[idx]) - 8,
        tooltipData: { ...trend[idx], x: tx },
      });
    },
    [xScale, yScale, trend, values, showTooltip]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
    hideTooltip();
  }, [hideTooltip]);

  return (
    <div>
      <p className={`trend-head num ${tone}`}>
        {change === null
          ? "Kỳ trước chưa có chi tiêu để so"
          : change === 0
            ? "Bằng đúng kỳ trước"
            : `${change > 0 ? "+" : "−"}${Math.abs(change)}% so với kỳ trước`}
      </p>

      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          className="spark"
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* Vùng tô dưới đường */}
          <AreaClosed
            data={trend}
            x={(_, i) => xScale(i)}
            y={(d) => yScale(d.amount)}
            yScale={yScale}
            curve={curveMonotoneX}
            className="spark-area"
          />

          {/* Đường xu hướng */}
          <LinePath
            data={trend}
            x={(_, i) => xScale(i)}
            y={(d) => yScale(d.amount)}
            curve={curveMonotoneX}
            className="spark-line"
          />

          {/* Vạch dọc — di chuyển theo hover hoặc đứng tại điểm cuối */}
          <line
            className="spark-now"
            x1={markerX}
            y1={Math.max(0, markerY - 5)}
            x2={markerX}
            y2={Math.min(SPARK_H, markerY + 5)}
          />

          {/* Vùng trong suốt bắt sự kiện chuột */}
          <rect
            x={0}
            y={0}
            width={SPARK_W}
            height={SPARK_H}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>

        {tooltipOpen && tooltipData && (
          <TooltipInPortal
            top={tooltipTop}
            left={tooltipLeft}
            className="chart-tooltip"
          >
            <span className="chart-tooltip-label">{tooltipData.label}</span>
            <span className="chart-tooltip-value num">
              {formatVnd(tooltipData.amount)}
            </span>
          </TooltipInPortal>
        )}
      </div>

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
