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
import BillSheet from "@/components/BillSheet";
import {
  CategoryDonut,
  PaidRanking,
  SpendBars,
  TrendSpark,
} from "@/components/Charts";
import {
  IconAdd,
  IconAlert,
  IconBack,
  IconChevron,
  IconSettle,
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

export default function Dashboard({
  user,
  groups: initialGroups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const [groups] = useState(initialGroups);
  const [group, setGroup] = useState<Group | null>(null);
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openBill, setOpenBill] = useState<Bill | null>(null);

  useEffect(() => {
    setGroup(resolveGroup(groups));
  }, [groups]);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiJson<Overview>(
        `/api/groups/${group.id}/overview?period=${kind}&offset=${offset}`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [group, kind, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const myBalance = useMemo(
    () => data?.balances.find((b) => b.userId === user.id) ?? null,
    [data, user.id]
  );

  const maxAbs = useMemo(
    () => Math.max(1, ...(data?.balances ?? []).map((b) => Math.abs(b.net))),
    [data]
  );

  if (groups.length === 0) {
    return (
      <div className="shell">
        <header className="topbar">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand">Poco Biller</span>
        </header>
        <div className="card card-pad empty">
          <p className="empty-title">Bạn chưa ở trong nhóm nào</p>
          <p className="muted">Tạo nhóm mới hoặc nhập mã mời để bắt đầu ghi bill.</p>
          <Link href="/cai-dat" className="btn btn-primary" style={{ marginTop: 12 }}>
            Tới cài đặt nhóm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand">Poco Biller</span>
        <span className="spacer" />
        {group && (
          <GroupPicker
            groups={groups}
            current={group}
            onChange={(g) => {
              rememberGroupId(g.id);
              setGroup(g);
              setOffset(0);
            }}
          />
        )}
      </header>

      {/* Kỳ xem là lựa chọn loại trừ nhau → segmented control, không phải chip */}
      <div
        className="segmented"
        role="group"
        aria-label="Kỳ xem"
        style={{ marginBottom: 14 }}
      >
        {PERIODS.map((p) => (
          <button
            key={p.kind}
            type="button"
            className="segment"
            aria-pressed={kind === p.kind}
            onClick={() => {
              setKind(p.kind);
              setOffset(0);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {/* Số dư của tôi */}
      <section className="section">
        <div className="card">
          <div className="card-pad">
            <div className="row" style={{ marginBottom: 2 }}>
              <span className="stat-label" style={{ margin: 0 }}>
                {myBalance && myBalance.net < 0
                  ? "Bạn còn phải trả"
                  : myBalance && myBalance.net > 0
                    ? "Nhóm còn nợ bạn"
                    : "Bạn đã cân bằng"}
              </span>
              <span className="spacer" />
              {kind !== "all" && (
                <span className="row" style={{ gap: 2 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setOffset(offset - 1)}
                    aria-label="Kỳ trước"
                  >
                    <IconBack size={ICON_SIZE.md} />
                  </button>
                  <span className="faint">{data?.period.label ?? "…"}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setOffset(Math.min(0, offset + 1))}
                    disabled={offset >= 0}
                    aria-label="Kỳ sau"
                  >
                    <IconChevron size={ICON_SIZE.md} />
                  </button>
                </span>
              )}
            </div>
            <p
              className={`num amount-lg ${
                myBalance && myBalance.net < 0
                  ? "debt"
                  : myBalance && myBalance.net > 0
                    ? "credit"
                    : ""
              }`}
              style={{ margin: 0 }}
            >
              {loading && !data
                ? "…"
                : formatVnd(Math.abs(myBalance?.net ?? 0))}
            </p>
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

      {/* Chart chỉ có ý nghĩa khi trong kỳ đã có bill */}
      {data && data.bills.length > 0 && (
        <>
          {/* Xu hướng — "all" không có kỳ trước nên API trả trend rỗng */}
          {data.trend.length >= 2 && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Xu hướng chi tiêu</h2>
              </div>
              <div className="card card-pad">
                <TrendSpark trend={data.trend} />
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">
                Chi theo {kind === "week" ? "ngày" : "thời gian"}
              </h2>
            </div>
            <div className="card card-pad">
              <SpendBars
                bills={data.bills}
                from={data.period.from}
                to={data.period.to}
              />
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Tiền đi vào đâu</h2>
            </div>
            <div className="card card-pad">
              <CategoryDonut
                data={data.totals.byCategory}
                total={data.totals.spent}
              />
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Ai ứng nhiều nhất</h2>
            </div>
            <div className="card card-pad">
              <PaidRanking balances={data.balances} currentUserId={user.id} />
            </div>
          </section>
        </>
      )}

      {/* Dải số dư cả nhóm */}
      {data && data.balances.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Số dư từng người</h2>
          </div>
          <div className="card balances">
            {data.balances
              .slice()
              .sort((a, b) => a.net - b.net)
              .map((b) => {
                const pct = (Math.abs(b.net) / maxAbs) * 50;
                return (
                  <div className="bal-row" key={b.userId}>
                    <div className="bal-head">
                      <span className="bal-name">
                        {b.name}
                        {b.userId === user.id && (
                          <span className="tag tag-blue" style={{ marginLeft: 6 }}>
                            Bạn
                          </span>
                        )}
                      </span>
                      <span
                        className={`num bal-net ${
                          b.net < 0 ? "debt" : b.net > 0 ? "credit" : "muted"
                        }`}
                      >
                        {b.net === 0
                          ? "Cân bằng"
                          : b.net < 0
                            ? `nợ ${formatShort(-b.net)}`
                            : `nhận ${formatShort(b.net)}`}
                      </span>
                    </div>
                    <div className="bal-track">
                      <div
                        className={`bal-fill ${b.net < 0 ? "neg" : "pos"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="faint tiny" style={{ margin: 0 }}>
                      Đã ứng {formatShort(b.paid)} · phần phải trả{" "}
                      {formatShort(b.owed)}
                    </p>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Danh sách bill */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Bill trong kỳ</h2>
          <span className="spacer" />
          <Link href="/them" className="link tiny">
            Thêm bill
          </Link>
        </div>

        {loading && !data ? (
          <div className="card card-pad muted">Đang tải…</div>
        ) : data && data.bills.length > 0 ? (
          <div className="card">
            <ul className="ledger">
              {data.bills.map((b) => {
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
                      <span className="entry-main">
                        <span className="entry-title">{b.title}</span>
                        <span className="faint" style={{ display: "block" }}>
                          {b.paidByName} ứng · {categoryLabel(b.category)} ·{" "}
                          {b.shares.length} người
                        </span>
                      </span>
                      <span className="entry-amount">
                        <span className="num">{formatShort(b.total)}</span>
                        <span
                          className="faint tiny num"
                          style={{ display: "block" }}
                        >
                          {mine ? `bạn ${formatShort(mine.amount)}` : "bạn 0"}
                        </span>
                      </span>
                      {/* Disclosure indicator: dấu hiệu thị giác cho dòng bấm được */}
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

      {/* Lịch sử trả nợ */}
      {data && data.settlements.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Đã trả nhau</h2>
          </div>
          <div className="card">
            <ul className="ledger">
              {data.settlements.map((s) => (
                <li key={s.id}>
                  <div className="entry" style={{ cursor: "default" }}>
                    <IconSettle
                      size={ICON_SIZE.md}
                      className="entry-chevron"
                    />
                    <span className="entry-main">
                      <span className="entry-title">
                        {s.fromName} → {s.toName}
                      </span>
                      <span className="faint" style={{ display: "block" }}>
                        {s.paidOn.split("-").reverse().join("/")}
                        {s.note ? ` · ${s.note}` : ""}
                      </span>
                    </span>
                    <span className="entry-amount num credit">
                      {formatShort(s.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
  );
}
