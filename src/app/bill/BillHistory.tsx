"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson, rememberGroupId, resolveGroup, type Overview } from "@/lib/client";
import { formatShort } from "@/lib/money";
import { formatDateVn, sectionLabel } from "@/lib/period";
import { categoryColor } from "@/lib/chart";
import {
  CATEGORIES,
  categoryLabel,
  type Bill,
  type Group,
  type PeriodKind,
  type SessionUser,
} from "@/lib/types";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import BillSheet from "@/components/BillSheet";
import { TrendSpark } from "@/components/Charts";
import Avatar from "@/components/Avatar";
import Mascot from "@/components/Mascot";
import { categoryIcon } from "@/lib/avatars";
import {
  IconAdd,
  IconAlert,
  IconBack,
  IconChevron,
  IconReceipt,
  IconSearch,
  IconSettle,
  ICON_SIZE,
} from "@/components/Icons";

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Tuần" },
  { kind: "month", label: "Tháng" },
  { kind: "quarter", label: "Quý" },
  { kind: "all", label: "Tất cả" },
];

type BillStatus = "owe" | "receive" | "done";

const STATUS_FILTERS: { key: "all" | BillStatus; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "owe", label: "Bạn cần trả" },
  { key: "receive", label: "Bạn sẽ nhận" },
  { key: "done", label: "Đã hoàn tất" },
];

const STATUS_TEXT: Record<BillStatus, string> = {
  owe: "Bạn cần trả",
  receive: "Bạn sẽ nhận",
  done: "Đã hoàn tất",
};

const STATUS_TONE: Record<BillStatus, string> = {
  owe: "debt",
  receive: "credit",
  done: "muted",
};

/** Trạng thái bill với người đang xem — suy từ shares/paidBy sẵn có, không
 *  đổi logic balance.ts. */
function billStatus(b: Bill, userId: number): BillStatus {
  const mine = b.shares.find((s) => s.userId === userId);
  if (b.paidBy === userId) {
    const receivable = b.total - (mine?.amount ?? 0);
    return receivable > 0 ? "receive" : "done";
  }
  return (mine?.amount ?? 0) > 0 ? "owe" : "done";
}

export default function BillHistory({
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
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<"all" | BillStatus>("all");
  const [query, setQuery] = useState("");
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

  const maxAbs = useMemo(
    () => Math.max(1, ...(data?.balances ?? []).map((b) => Math.abs(b.net))),
    [data]
  );

  const usedCategories = useMemo(() => {
    const ids = new Set((data?.bills ?? []).map((b) => b.category));
    return CATEGORIES.filter((c) => ids.has(c.id));
  }, [data]);

  const memberAvatars = useMemo(() => {
    const m = new Map<number, string>();
    for (const mem of data?.members ?? []) m.set(mem.userId, mem.avatar);
    return m;
  }, [data]);

  const filteredBills = useMemo(() => {
    let list = data?.bills ?? [];
    if (category !== "all") list = list.filter((b) => b.category === category);
    if (status !== "all") list = list.filter((b) => billStatus(b, user.id) === status);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.paidByName.toLowerCase().includes(q)
      );
    return list;
  }, [data, category, status, query, user.id]);

  // Bill đã sắp DESC theo spentOn từ API — chỉ cần gộp các phần tử liền kề
  // cùng nhãn nhóm ngày, không cần sort lại.
  const billGroups = useMemo(() => {
    const out: { label: string; bills: Bill[] }[] = [];
    for (const b of filteredBills) {
      const label = sectionLabel(b.spentOn);
      const last = out[out.length - 1];
      if (last && last.label === label) last.bills.push(b);
      else out.push({ label, bills: [b] });
    }
    return out;
  }, [filteredBills]);

  if (groups.length === 0) {
    return (
      <div className="shell">
        <header className="topbar">
          <IconReceipt size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
          <span className="brand">Bill</span>
        </header>
        <div className="card card-pad muted">Bạn chưa ở trong nhóm nào.</div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={load}>
    <div className="shell">
      <header className="topbar">
        <IconReceipt size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
        <span className="brand">Bill</span>
        <span className="spacer" />
        {group && (
          <GroupPicker
            groups={groups}
            current={group}
            onChange={(g) => {
              rememberGroupId(g.id);
              setGroup(g);
              setOffset(0);
              setCategory("all");
              setStatus("all");
              setQuery("");
            }}
          />
        )}
      </header>

      <div className="field" style={{ marginBottom: 12 }}>
        <div className="row" style={{ position: "relative" }}>
          <IconSearch
            size={ICON_SIZE.sm}
            className="faint"
            style={{ position: "absolute", left: 12 }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên bill…"
            aria-label="Tìm bill"
          />
        </div>
      </div>

      <div
        className="segmented segmented-bold"
        role="group"
        aria-label="Kỳ xem"
        style={{ marginBottom: 12 }}
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

      {kind !== "all" && (
        <div className="row" style={{ marginBottom: 12, justifyContent: "center" }}>
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
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="stats">
          <div className="stat">
            <p className="stat-label">Số bill</p>
            <p className="num stat-value">{data?.totals.billCount ?? 0}</p>
          </div>
          <div className="stat">
            <p className="stat-label">Tổng chi</p>
            <p className="num stat-value">{formatShort(data?.totals.spent ?? 0)}</p>
          </div>
        </div>
        {data && data.trend.length >= 2 && (
          <>
            <div className="divider" style={{ margin: 0 }} />
            <div className="card-pad">
              <TrendSpark trend={data.trend} />
            </div>
          </>
        )}
      </div>

      {usedCategories.length > 1 && (
        <div className="chips" role="group" aria-label="Lọc theo hạng mục" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="chip"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            Tất cả
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="chips" role="group" aria-label="Lọc theo trạng thái" style={{ marginBottom: 14 }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip"
            aria-pressed={status === f.key}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {/* Danh sách bill */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">
            {category === "all" ? "Bill trong kỳ" : categoryLabel(category)}
          </h2>
          <span className="spacer" />
          <Link href="/them" className="link tiny">
            Thêm bill
          </Link>
        </div>

        {loading && !data ? (
          <div className="card card-pad muted">Đang tải…</div>
        ) : filteredBills.length > 0 ? (
          <div className="stack">
            {billGroups.map((g) => (
              <div key={g.label}>
                <p className="section-title" style={{ margin: "0 4px 8px" }}>
                  {g.label}
                </p>
                <div className="card">
                  <ul className="ledger">
                    {g.bills.map((b) => {
                      const bs = billStatus(b, user.id);
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            className="entry entry-roomy"
                            onClick={() => setOpenBill(b)}
                          >
                            <span
                              className="cat-ic cat-ic-lg cat-ic-circle"
                              aria-hidden="true"
                              style={{
                                background: `color-mix(in srgb, ${categoryColor(b.category)} 18%, var(--bg-elevated))`,
                              }}
                            >
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
                                  {formatDateVn(b.spentOn)} · {b.shares.length} người
                                </span>
                              </span>
                            </span>
                            <span className="entry-amount">
                              <span className="num">{formatShort(b.total)}</span>
                              <span
                                className={`tiny num ${STATUS_TONE[bs]}`}
                                style={{ display: "block" }}
                              >
                                {STATUS_TEXT[bs]}
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
              </div>
            ))}
          </div>
        ) : (
          <div className="card card-pad empty">
            <Mascot name="scan" size={128} />
            <p className="empty-title">
              {category === "all" && status === "all" && !query.trim()
                ? "Kỳ này chưa có bill nào"
                : "Không có bill khớp với bộ lọc"}
            </p>
            <p className="muted">
              Chụp hoá đơn, gõ một câu cho AI, hoặc nhập tay — cách nào cũng được.
            </p>
            <Link href="/them" className="btn btn-primary" style={{ marginTop: 12 }}>
              <IconAdd size={ICON_SIZE.md} /> Thêm bill đầu tiên
            </Link>
          </div>
        )}
      </section>

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
                      <Avatar avatarId={b.avatar} name={b.name} size={28} />
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
    </PullToRefresh>
  );
}
