"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson, rememberGroupId, resolveGroup, type Overview } from "@/lib/client";
import type { Group, Member, SessionUser } from "@/lib/types";
import { groupProgress } from "@/lib/gamification";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import CopyButton from "@/components/CopyButton";
import Avatar from "@/components/Avatar";
import GroupProgress from "@/components/GroupProgress";
import {
  IconAlert,
  IconBack,
  IconGear,
  IconMemberAdd,
  IconOk,
  IconSearch,
  IconSpinner,
  IconTrash,
  ICON_SIZE,
} from "@/components/Icons";

export default function GroupMembers({
  user,
  groups: initialGroups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [progress, setProgress] = useState<ReturnType<typeof groupProgress> | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showOtherGroups, setShowOtherGroups] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  useEffect(() => setGroup(resolveGroup(groups)), [groups]);

  const load = useCallback(async () => {
    if (!group) return;
    setError("");
    try {
      const m = await apiJson<{ members: Member[] }>(`/api/groups/${group.id}/members`);
      setMembers(m.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thành viên.");
    }
    try {
      const o = await apiJson<Overview>(`/api/groups/${group.id}/overview?period=all&offset=0`);
      setProgress(groupProgress(o.members, o.bills, o.settlements));
    } catch {
      setProgress(null);
    }
  }, [group]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = members.find((m) => m.userId === user.id)?.role === "admin";

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  async function refreshGroups(select?: number) {
    const res = await apiJson<{ groups: Group[] }>("/api/groups");
    setGroups(res.groups);
    if (select) {
      rememberGroupId(select);
      setGroup(res.groups.find((g) => g.id === select) ?? null);
    }
  }

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác không thành công.");
    } finally {
      setBusy("");
    }
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="shell">
        <header className="topbar">
          <Link href="/cai-dat" className="btn btn-ghost btn-icon btn-sm" aria-label="Quay lại">
            <IconBack size={ICON_SIZE.md} />
          </Link>
          <IconGear size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
          <span className="brand">Thành viên nhóm</span>
          <span className="spacer" />
          {isAdmin && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Thêm thành viên"
              onClick={() => setShowAdd(!showAdd)}
            >
              <IconMemberAdd size={ICON_SIZE.md} />
            </button>
          )}
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
        </header>

        {error && (
          <p className="error" style={{ marginBottom: 14 }} role="alert">
            <IconAlert size={ICON_SIZE.sm} />
            <span>{error}</span>
          </p>
        )}
        {notice && (
          <p className="notice" style={{ marginBottom: 14 }} role="status">
            <IconOk size={ICON_SIZE.sm} />
            <span>{notice}</span>
          </p>
        )}

        {group && (
          <section className="section">
            <div className="card card-pad stack" style={{ background: "var(--tint-wash)" }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Mời thêm bạn vào nhóm</p>
                <p className="faint" style={{ margin: "2px 0 0" }}>
                  Chia bill cùng nhau dễ hơn
                </p>
              </div>
              <div className="row">
                <span className="code" style={{ fontSize: 20, flex: 1 }}>
                  {group.inviteCode}
                </span>
              </div>
              <CopyButton
                label="Sao chép mã mời"
                text={group.inviteCode}
                className="btn btn-primary btn-block"
              />
            </div>
          </section>
        )}

        {group && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">{members.length} thành viên</h2>
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <div className="row" style={{ position: "relative" }}>
                <IconSearch size={ICON_SIZE.sm} className="faint" style={{ position: "absolute", left: 12 }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm thành viên"
                  aria-label="Tìm thành viên"
                />
              </div>
            </div>

            <div className="card">
              <ul className="ledger">
                {filteredMembers.map((m) => (
                  <li key={m.userId}>
                    <div className="entry" style={{ cursor: "default" }}>
                      <Avatar avatarId={m.avatar} name={m.name} size={40} />
                      <span className="entry-main">
                        <span className="entry-title">{m.name}</span>
                        <span className="faint" style={{ display: "block" }}>
                          {m.userId === user.id ? "Bạn" : "Thành viên"}
                          {m.role === "admin" ? " · Quản trị viên" : ""}
                        </span>
                      </span>
                      {isAdmin && m.userId !== user.id && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger btn-icon"
                          aria-label={`Xoá ${m.name} khỏi nhóm`}
                          disabled={busy === `rm-${m.userId}`}
                          onClick={() =>
                            act(`rm-${m.userId}`, async () => {
                              const res = await apiJson<{ members: Member[] }>(
                                `/api/groups/${group.id}/members`,
                                {
                                  method: "DELETE",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({ userId: m.userId }),
                                }
                              );
                              setMembers(res.members);
                              setNotice(`Đã xoá ${m.name} khỏi nhóm.`);
                            })
                          }
                        >
                          {busy === `rm-${m.userId}` ? (
                            <IconSpinner size={ICON_SIZE.sm} />
                          ) : (
                            <IconTrash size={ICON_SIZE.sm} />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {isAdmin && showAdd && (
                <div className="card-pad stack" style={{ borderTop: "1px solid var(--rule)" }}>
                  <p className="section-title" style={{ margin: 0 }}>
                    Thêm thành viên
                  </p>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <input
                      className="input"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Tên"
                      aria-label="Tên thành viên"
                    />
                    <input
                      className="input"
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="email@..."
                      aria-label="Email thành viên"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={busy === "addMember" || !memberName.trim() || !memberEmail.trim()}
                    onClick={() =>
                      act("addMember", async () => {
                        const res = await apiJson<{
                          members: Member[];
                          tempPassword: string | null;
                        }>(`/api/groups/${group.id}/members`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            name: memberName.trim(),
                            email: memberEmail.trim(),
                          }),
                        });
                        setMembers(res.members);
                        setNotice(
                          res.tempPassword
                            ? `Đã thêm ${memberName.trim()}. Mật khẩu tạm để họ đăng nhập: ${res.tempPassword}`
                            : `Đã thêm ${memberName.trim()} vào nhóm. Họ đăng nhập bằng tài khoản có sẵn.`
                        );
                        setMemberName("");
                        setMemberEmail("");
                        setShowAdd(false);
                      })
                    }
                  >
                    <IconMemberAdd size={ICON_SIZE.sm} /> Thêm vào nhóm
                  </button>
                  <p className="hint">
                    Người mới đăng nhập bằng email và mật khẩu tạm hiện ra sau khi thêm.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {progress && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Hoạt động nhóm</h2>
            </div>
            <GroupProgress progress={progress} groupName={group?.name} />
          </section>
        )}

        <section className="section">
          <button
            type="button"
            className="btn"
            onClick={() => setShowOtherGroups(!showOtherGroups)}
          >
            {showOtherGroups ? "Ẩn" : "Tạo nhóm mới hoặc vào nhóm khác"}
          </button>

          {showOtherGroups && (
            <div className="card card-pad stack" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="label" htmlFor="newGroup">
                  Tạo nhóm mới
                </label>
                <div className="row">
                  <input
                    id="newGroup"
                    className="input"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Team Marketing"
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy === "newGroup" || !newGroupName.trim()}
                    onClick={() =>
                      act("newGroup", async () => {
                        const res = await apiJson<{ group: Group }>("/api/groups", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ name: newGroupName.trim() }),
                        });
                        setNewGroupName("");
                        await refreshGroups(res.group.id);
                        setNotice(`Đã tạo nhóm ${res.group.name}.`);
                      })
                    }
                  >
                    Tạo
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="joinCode">
                  Vào nhóm bằng mã mời
                </label>
                <div className="row">
                  <input
                    id="joinCode"
                    className="input"
                    style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ABC234"
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy === "join" || !inviteCode.trim()}
                    onClick={() =>
                      act("join", async () => {
                        const res = await apiJson<{ group: Group }>("/api/groups", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ inviteCode: inviteCode.trim() }),
                        });
                        setInviteCode("");
                        await refreshGroups(res.group.id);
                        setNotice(`Đã vào nhóm ${res.group.name}.`);
                      })
                    }
                  >
                    Vào nhóm
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </PullToRefresh>
  );
}
