"use client";

import { useState, useEffect, useCallback } from "react";
import { apiJson } from "@/lib/client";
import { IconAlert, IconSave, IconSpinner, ICON_SIZE } from "@/components/Icons";
import { BalancePie, CategoryDonut } from "@/components/Charts";

type GroupStat = {
  id: number;
  name: string;
  memberCount: number;
  billCount: number;
  totalSpent: number;
  lastActivity: string | null;
};

type SystemStats = {
  totalGroups: number;
  groups: GroupStat[];
  billTrend: { date: string; count: number }[];
};

export default function SuperViews() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = btoa(`${process.env.NEXT_PUBLIC_ADMIN_USERNAME || ""}:${process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ""}`);
      const res = await apiJson<SystemStats>("/api/admin/stats", {
        headers: { "Authorization": `Basic ${auth}` }
      });
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  async function handleUpdateName(id: number) {
    if (!editName.trim()) return;
    setUpdatingId(id);
    try {
      const auth = btoa(`${process.env.NEXT_PUBLIC_ADMIN_USERNAME || ""}:${process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ""}`);
      await apiJson("/api/admin/stats", {
        method: "PATCH",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ groupId: id, name: editName }),
      });
      setEditingId(null);
      void loadStats();
    } catch (e) {
      setError("Không thể cập nhật tên nhóm.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && !stats) {
    return <div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><IconSpinner size={40} /></div>;
  }

  // --- Data Processing for Charts ---

  // 1. Group Size Distribution (Donut)
  const sizeDist = {
    "1-3 người": 0,
    "4-6 người": 0,
    "7-10 người": 0,
    "11+ người": 0,
  };
  stats?.groups.forEach(g => {
    if (g.memberCount <= 3) sizeDist["1-3 người"]++;
    else if (g.memberCount <= 6) sizeDist["4-6 người"]++;
    else if (g.memberCount <= 10) sizeDist["7-10 người"]++;
    else sizeDist["11+ người"]++;
  });
  const distributionData = Object.entries(sizeDist).map(([name, value]) => ({ name, value }));

  // 2. Top 5 Spending Groups (Bar)
  const topSpending = [...(stats?.groups ?? [])]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5)
    .map(g => ({ name: g.name, value: g.totalSpent }));

  // 3. Activity Trend (Line/Area)
  const trendData = stats?.billTrend.map(t => ({ name: t.date, value: t.count })) ?? [];

  const emptyGroups = stats?.groups.filter(g => g.memberCount === 0).length ?? 0;
  const activeGroups = stats?.groups.filter(g => g.memberCount > 0).length ?? 0;

  return (
    <div className="shell" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
      <header className="topbar">
        <span className="brand">System Superviews</span>
        <span className="tag tag-blue">Admin Only</span>
      </header>

      {error && (
        <div className="card" style={{ padding: 12, marginBottom: 20, color: "var(--error)", display: "flex", gap: 8, alignItems: "center" }}>
          <IconAlert size={ICON_SIZE.sm} /> {error}
        </div>
      )}

      {/* Quick Summary */}
      <section className="section" style={{ marginTop: 24 }}>
        <div className="stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <p className="stat-label">Tổng số nhóm</p>
            <p className="num stat-value" style={{ fontSize: 32 }}>{stats?.totalGroups ?? 0}</p>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <p className="stat-label">Nhóm có thành viên</p>
            <p className="num stat-value" style={{ fontSize: 32, color: "var(--tint-strong)" }}>{activeGroups}</p>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <p className="stat-label">Nhóm trống</p>
            <p className="num stat-value" style={{ fontSize: 32, color: "var(--error)" }}>{emptyGroups}</p>
          </div>
        </div>
      </section>

      {/* Charts Section */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Phân tích hệ thống</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div className="card card-pad">
            <p className="stat-label" style={{ textAlign: "center", marginBottom: 16 }}>Quy mô nhóm</p>
            <div style={{ height: 200, display: "flex", justifyContent: "center" }}>
              <CategoryDonut data={distributionData} total={stats?.totalGroups ?? 0} />
            </div>
          </div>
          <div className="card card-pad">
            <p className="stat-label" style={{ textAlign: "center", marginBottom: 16 }}>Top 5 Nhóm chi tiêu</p>
            <div style={{ height: 200, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
              {topSpending.map((g, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="faint tiny" style={{ width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                  <div style={{ flex: 1, height: 12, background: "var(--fill-quaternary)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--tint-strong)", width: `${(g.value / (topSpending[0]?.value || 1)) * 100}%` }} />
                  </div>
                  <span className="num tiny">{g.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <p className="stat-label" style={{ textAlign: "center", marginBottom: 16 }}>Xu hướng tạo Bill</p>
            <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: 4, paddingBottom: 10 }}>
              {trendData.slice(-14).map((t, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: "100%",
                    background: "var(--tint-strong)",
                    borderRadius: "4px 4px 0 0",
                    height: `${(t.value / (Math.max(...trendData.map(v => v.value), 1))) * 150}px`
                  }} />
                  <span className="faint" style={{ fontSize: 8, transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{t.name.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Management Table */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Quản lý Nhóm</h2>
        </div>
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "var(--fill-quaternary)" }}>
              <tr style={{ textAlign: "left", color: "var(--label-secondary)" }}>
                <th style={{ padding: "12px 16px" }}>Tên Nhóm</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Thành viên</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Số Bill</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Hoạt động cuối</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {stats?.groups.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid var(--separator)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    {editingId === g.id ? (
                      <input
                        className="input"
                        style={{ width: "100%", padding: "4px 8px" }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: 500 }}>{g.name}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{g.memberCount}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{g.billCount}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--label-tertiary)" }}>
                    {g.lastActivity ? g.lastActivity : "Chưa có"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {editingId === g.id ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Hủy
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={updatingId === g.id}
                          onClick={() => handleUpdateName(g.id)}
                        >
                          {updatingId === g.id ? <IconSpinner size={14} /> : <IconSave size={14} />}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingId(g.id); setEditName(g.name); }}
                      >
                        Sửa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
