"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson, rememberGroupId, resolveGroup, type Overview } from "@/lib/client";
import { formatVnd, formatShort } from "@/lib/money";
import {
  categoryLabel,
  type Bill,
  type Group,
  type PeriodKind,
  type SessionUser,
} from "@/lib/types";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import BillSheet from "@/components/BillSheet";
import GroupProgress from "@/components/GroupProgress";
import Badges from "@/components/Badges";
import Mascot from "@/components/Mascot";
import Avatar from "@/components/Avatar";
import { categoryIcon } from "@/lib/avatars";
import {
  computeBadges,
  groupProgress,
  teamEnergy,
} from "@/lib/gamification";
import { CategoryDonut, TrendSpark } from "@/components/Charts";
import {
  IconAdd,
  IconAlert,
  IconChevron,
  IconLedger,
  IconReceiveCircle,
  ICON_SIZE,
} from "@/components/Icons";

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Tuần" },
  { kind: "month", label: "Tháng" },
  { kind: "quarter", label: "Quý" },
  { kind: "all", label: "Tất cả" },
];

const MONTH_SHORT = [
  "T1", "T2", "T3", "T4", "T5", "T6",
  "T7", "T8", "T9", "T10", "T11", "T12",
];

/** Số bill gần nhất hiện trong phần xem trước — còn lại xem hết ở tab Bill. */
const PREVIEW_COUNT = 3;

export default function Dashboard({
  user,
  groups: initialGroups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const [groups] = useState(initialGroups);
  const [group, setGroup] = useState<Group | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openBill, setOpenBill] = useState<Bill | null>(null);

  // Kỳ xem riêng cho phần "Xu hướng chi tiêu" / "Tiền đi vào đâu" — phần còn
  // lại của trang (số dư, tiến độ, huy hiệu, bill gần đây) luôn xem "Tất cả".
  const [chartKind, setChartKind] = useState<PeriodKind>("month");
  const [chartData, setChartData] = useState<Overview | null>(null);

  useEffect(() => {
    setGroup(resolveGroup(groups));
  }, [groups]);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiJson<Overview>(
        `/api/groups/${group.id}/overview?period=all&offset=0`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!group) return;
    apiJson<Overview>(`/api/groups/${group.id}/overview?period=${chartKind}&offset=0`)
      .then(setChartData)
      .catch(() => setChartData(null));
  }, [group, chartKind]);

  // Số cần trả / sẽ nhận tách riêng — suy từ transfer trực tiếp đã có sẵn
  // trong Overview (suggestDirectTransfers), không đổi logic balance.ts.
  const oweTotal = useMemo(
    () =>
      (data?.transfers ?? [])
        .filter((t) => t.fromUserId === user.id)
        .reduce((sum, t) => sum + t.amount, 0),
    [data, user.id]
  );
  const receiveTotal = useMemo(
    () =>
      (data?.transfers ?? [])
        .filter((t) => t.toUserId === user.id)
        .reduce((sum, t) => sum + t.amount, 0),
    [data, user.id]
  );

  const memberAvatars = useMemo(() => {
    const m = new Map<number, string>();
    for (const mem of data?.members ?? []) m.set(mem.userId, mem.avatar);
    return m;
  }, [data]);

  // Gamification cộng tác — suy hoàn toàn từ dữ liệu Overview đã tải.
  const progress = useMemo(
    () =>
      data ? groupProgress(data.members, data.bills, data.settlements) : null,
    [data]
  );
  const energy = useMemo(
    () => (data ? teamEnergy(data.members, data.bills, data.settlements) : null),
    [data]
  );
  const badges = useMemo(
    () =>
      data
        ? computeBadges({
            members: data.members,
            bills: data.bills,
            settlements: data.settlements,
          })
        : [],
    [data]
  );

  if (groups.length === 0) {
    return (
      <div className="shell">
        <header className="topbar">
          <IconLedger size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
          <span className="brand">Poco Biller</span>
        </header>
        <div className="card card-pad empty">
          <Mascot name="celebrate" size={128} />
          <p className="empty-title">Bạn chưa ở trong nhóm nào</p>
          <p className="muted">Tạo nhóm mới hoặc nhập mã mời để bắt đầu ghi bill.</p>
          <Link href="/cai-dat" className="btn btn-primary" style={{ marginTop: 12 }}>
            Tới cài đặt nhóm
          </Link>
        </div>
      </div>
    );
  }

  const preview = data?.bills.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <PullToRefresh onRefresh={load}>
    <div className="shell">
      <header className="topbar" style={{ flexWrap: "wrap" }}>
        <div className="row" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span className="brand" style={{ display: "block" }}>
              Chào {user.name.split(" ")[0] || user.name}!
            </span>
            {group && (
              <GroupPicker
                groups={groups}
                current={group}
                onChange={(g) => {
                  rememberGroupId(g.id);
                  setGroup(g);
                }}
              />
            )}
          </div>
        </div>
        <Link href="/cai-dat" aria-label="Cá nhân">
          <Avatar avatarId={user.avatar} name={user.name} size={40} />
        </Link>
      </header>

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {/* Tiến độ nhóm (gamification cộng tác) — chỉ khi kỳ đã có bill */}
      {data && data.bills.length > 0 && progress && (
        <section className="section">
          {energy && (
            <div className="section-head">
              <span className={`energy-chip energy-${energy.state}`}>
                {energy.label}
              </span>
            </div>
          )}
          <GroupProgress progress={progress} groupName={group?.name} />
        </section>
      )}

      {/* Số dư của tôi — tách 2 chiều cần trả / sẽ nhận */}
      <section className="section">
        <div className="card card-wavy">
          <div className="card-pad">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="stat-label" style={{ margin: 0 }}>
                Số dư của bạn
              </span>
            </div>

            {loading && !data ? (
              <p className="num amount-lg" style={{ margin: 0 }}>
                …
              </p>
            ) : oweTotal <= 0 && receiveTotal <= 0 ? (
              <p className="num amount-lg" style={{ margin: 0 }}>
                Bạn đã cân bằng
              </p>
            ) : (
              <div>
                {oweTotal > 0 && (
                  <div className="owe-row">
                    <span className="owe-ic owe-ic-warn">
                      <IconAlert filled size={ICON_SIZE.md} />
                    </span>
                    <p style={{ margin: 0, flex: 1 }}>
                      <span className="faint" style={{ display: "block" }}>
                        Bạn còn
                      </span>
                      <span
                        className="num debt"
                        style={{ fontSize: 24, fontWeight: 700 }}
                      >
                        {formatVnd(oweTotal)}
                      </span>
                      <span className="faint" style={{ display: "block" }}>
                        cần thanh toán
                      </span>
                    </p>
                    <Link href="/nhac-no" className="btn btn-primary btn-pill">
                      Thanh toán ngay
                    </Link>
                  </div>
                )}
                {receiveTotal > 0 && (
                  <div className="owe-row">
                    <span className="owe-ic owe-ic-ok">
                      <IconReceiveCircle filled size={ICON_SIZE.md} />
                    </span>
                    <p style={{ margin: 0, flex: 1 }}>
                      <span className="faint">Bạn sẽ nhận</span>{" "}
                      <span
                        className="num credit"
                        style={{ fontSize: 20, fontWeight: 700 }}
                      >
                        {formatVnd(receiveTotal)}
                      </span>
                    </p>
                    <IconChevron size={ICON_SIZE.sm} className="entry-chevron" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="stats">
            <div className="stat">
              <p className="stat-label">Nhóm đã chi</p>
              <p className="num stat-value">
                {formatVnd(data?.totals.spent ?? 0)}
              </p>
            </div>
            <div className="stat">
              <p className="stat-label">Số bill</p>
              <p className="num stat-value">{data?.totals.billCount ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Chart chính — kỳ xem riêng, không ảnh hưởng số dư/tiến độ/bill gần đây */}
      {data && data.bills.length > 0 && (
        <>
          <div
            className="segmented"
            role="group"
            aria-label="Kỳ xem biểu đồ"
            style={{ marginBottom: 14 }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.kind}
                type="button"
                className="segment"
                aria-pressed={chartKind === p.kind}
                onClick={() => setChartKind(p.kind)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {chartData && chartData.trend.length >= 2 && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Xu hướng chi tiêu</h2>
              </div>
              <div className="card card-pad">
                <TrendSpark trend={chartData.trend} />
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Tiền đi vào đâu</h2>
            </div>
            {chartData && chartData.bills.length > 0 ? (
              <div className="card card-pad">
                <CategoryDonut
                  data={chartData.totals.byCategory}
                  total={chartData.totals.spent}
                />
              </div>
            ) : (
              <div className="card card-pad muted">Kỳ này chưa có bill nào</div>
            )}
          </section>

          {badges.some((b) => b.earned) && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Huy hiệu nhóm</h2>
              </div>
              <Badges badges={badges} showLocked={false} />
            </section>
          )}
        </>
      )}

      {/* Bill gần đây — chỉ xem trước, danh sách đầy đủ ở tab Bill */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Bill gần đây</h2>
          <span className="spacer" />
          <Link href="/bill" className="link tiny">
            Xem tất cả
          </Link>
        </div>

        {loading && !data ? (
          <div className="card card-pad muted">Đang tải…</div>
        ) : preview.length > 0 ? (
          <div className="card">
            <ul className="ledger">
              {preview.map((b) => {
                const mine = b.shares.find((s) => s.userId === user.id);
                const [, m, d] = b.spentOn.split("-");
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="entry"
                      onClick={() => setOpenBill(b)}
                    >
                      <span className="date-rail">
                        <span className="d">{d}</span>
                        <br />
                        <span className="m">{MONTH_SHORT[Number(m) - 1]}</span>
                      </span>
                      <span className="cat-ic" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={categoryIcon(b.category)} alt="" />
                      </span>
                      <span className="entry-main">
                        <span className="entry-title">{b.title}</span>
                        <span className="row" style={{ marginTop: 4, gap: 6 }}>
                          <span className="avatar-stack">
                            {b.shares.slice(0, 3).map((s) => (
                              <Avatar
                                key={s.userId}
                                avatarId={memberAvatars.get(s.userId)}
                                name={s.name}
                                size={20}
                              />
                            ))}
                          </span>
                          <span className="faint tiny">
                            {categoryLabel(b.category)}
                          </span>
                        </span>
                      </span>
                      <span className="entry-amount">
                        <span className="num">{formatShort(b.total)}</span>
                        <span
                          className={`tiny num ${
                            b.paidBy === user.id ? "credit" : "debt"
                          }`}
                          style={{ display: "block" }}
                        >
                          {b.paidBy === user.id
                            ? `bạn nhận ${formatShort(b.total - (mine?.amount ?? 0))}`
                            : `bạn trả ${formatShort(mine?.amount ?? 0)}`}
                        </span>
                      </span>
                      <IconChevron
                        size={ICON_SIZE.sm}
                        className="entry-chevron"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="card card-pad empty">
            <Mascot name="scan" size={128} />
            <p className="empty-title">Kỳ này chưa có bill nào</p>
            <p className="muted">
              Chụp hoá đơn, gõ một câu cho AI, hoặc nhập tay — cách nào cũng được.
            </p>
            <Link href="/them" className="btn btn-primary" style={{ marginTop: 12 }}>
              <IconAdd size={ICON_SIZE.md} /> Thêm bill đầu tiên
            </Link>
          </div>
        )}
      </section>

      {openBill && (
        <BillSheet
          bill={openBill}
          currentUserId={user.id}
          onClose={() => setOpenBill(null)}
          onDeleted={() => {
            setOpenBill(null);
            void load();
          }}
        />
      )}
    </div>
    </PullToRefresh>
  );
}
