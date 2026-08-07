"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiJson, rememberGroupId, resolveGroup } from "@/lib/client";
import type { Group, Member, SessionUser } from "@/lib/types";
import GroupPicker from "@/components/GroupPicker";
import PullToRefresh from "@/components/PullToRefresh";
import CopyButton from "@/components/CopyButton";
import {
  IconAlert,
  IconFileCsv,
  IconMemberAdd,
  IconOk,
  IconSignOut,
  IconSpinner,
  IconTrash,
  ICON_SIZE,
} from "@/components/Icons";

/** Cấu hình AI đang có hiệu lực. Không bao giờ chứa API key. */
type AiInfo = {
  host: string;
  model: string;
  maxTokens: number;
  authStyle: string;
  timeoutMs: number;
  hasKey: boolean;
};

/** Kết quả bấm "Kiểm tra kết nối". */
type AiPing = { ok: boolean; ms: number; sample?: string; message?: string };

type Bank = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  sepayCode?: string;
};

type UserBankAccount = {
  bankId: string;
  accountNumber: string;
  accountName: string;
};

export default function Settings({
  user,
  groups: initialGroups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [aiError, setAiError] = useState("");
  const [ping, setPing] = useState<AiPing | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const [bankAccount, setBankAccount] = useState<UserBankAccount | null>(null);
  const [allBanks, setAllBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState("");
  const [accountName, setAccountName] = useState(user.name);
  const [accountNumber, setAccountNumber] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  useEffect(() => setGroup(resolveGroup(groups)), [groups]);

  const load = useCallback(async () => {
    if (!group) return;
    setError("");
    try {
      const m = await apiJson<{ members: Member[] }>(
        `/api/groups/${group.id}/members`
      );
      setMembers(m.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được cài đặt.");
    }
  }, [group]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Cấu hình AI không phụ thuộc nhóm nên tải riêng, và lỗi của nó giữ ở state
   * riêng — env sai thì chỉ khối AI báo đỏ, không che mất phần cài đặt nhóm.
   */
  useEffect(() => {
    apiJson<AiInfo>("/api/ai/config")
      .then(setAi)
      .catch((e: unknown) =>
        setAiError(
          e instanceof Error ? e.message : "Không đọc được cấu hình AI."
        )
      );
  }, []);

  useEffect(() => {
    // These are user-specific, not group-specific
    Promise.all([
      apiJson<{ banks: Bank[] }>("/api/banks"),
      apiJson<{ account: UserBankAccount | null }>("/api/user/bank-account"),
    ])
      .then(([b, a]) => {
        setAllBanks(b.banks);
        setBankAccount(a.account);
        // If there is an account, pre-fill the form
        if (a.account) {
          setBankId(a.account.bankId);
          setAccountName(a.account.accountName);
          setAccountNumber(a.account.accountNumber);
        }
      })
      .catch((e) => {
        console.error("Failed to load payment info:", e);
      });
  }, [user.name]);

  const isAdmin =
    members.find((m) => m.userId === user.id)?.role === "admin";

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
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand">Cài đặt</span>
        <span className="spacer" />
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

      {/* Tài khoản */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Tài khoản</h2>
        </div>
        <div className="card card-pad">
          <div className="row">
            <span>
              <strong>{user.name}</strong>
              <span className="faint" style={{ display: "block" }}>
                {user.email}
              </span>
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => signOut({ callbackUrl: "/dang-nhap" })}
              disabled={busy === "logout"}
            >
              {busy === "logout" ? <IconSpinner size={ICON_SIZE.sm} /> : <IconSignOut size={ICON_SIZE.sm} />} Đăng xuất
            </button>
          </div>
        </div>
      </section>

      {/* Thông tin thanh toán */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Thông tin thanh toán</h2>
        </div>
        <div className="card card-pad stack">
          {bankAccount ? (
            <>
              {/* Đã lưu — chỉ hiện lại dạng bảng text, không cho sửa trực tiếp
                  để tránh gõ nhầm số tài khoản đang dùng cho QR; muốn đổi thì
                  xoá rồi nhập lại từ đầu. */}
              <dl className="kv">
                <dt>Ngân hàng</dt>
                <dd>
                  {allBanks.find((b) => b.id === bankAccount.bankId)?.shortName ??
                    bankAccount.bankId}
                </dd>
                <dt>Chủ tài khoản</dt>
                <dd>{bankAccount.accountName}</dd>
                <dt>Số tài khoản</dt>
                <dd className="kv-mono">{bankAccount.accountNumber}</dd>
              </dl>
              <button
                type="button"
                className="btn btn-danger btn-block"
                disabled={busy === "deleteAccount"}
                onClick={() =>
                  act("deleteAccount", async () => {
                    if (!window.confirm("Bạn có chắc muốn xoá thông tin tài khoản không?")) return;
                    await apiJson("/api/user/bank-account", { method: "DELETE" });
                    setBankAccount(null);
                    setAccountName(user.name);
                    setAccountNumber("");
                    setBankId("");
                    setNotice("Đã xoá thông tin tài khoản.");
                  })
                }
              >
                {busy === "deleteAccount" ? (
                  <><IconSpinner size={ICON_SIZE.sm} /> Đang xoá...</>
                ) : (
                  <><IconTrash size={ICON_SIZE.sm} /> Xoá thông tin tài khoản</>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="hint" style={{ margin: 0 }}>
                Thêm tài khoản ngân hàng của bạn để đưa vào nội dung nhắc nợ, giúp
                bạn bè tiện chuyển khoản.
              </p>
              <div className="field">
                <label className="label" htmlFor="bank">
                  Ngân hàng
                </label>
                <select
                  id="bank"
                  className="select"
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                >
                  <option value="">Chọn ngân hàng</option>
                  {allBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.shortName} ({b.id}){!b.sepayCode ? " — chưa hỗ trợ QR" : ""}
                    </option>
                  ))}
                </select>
                <p className="hint" style={{ margin: 0 }}>
                  Ngân hàng có gắn "chưa hỗ trợ QR" vẫn lưu được số tài khoản để
                  hiện trong lời nhắc, nhưng chưa sinh được mã QR quét chuyển
                  khoản nhanh.
                </p>
              </div>
              <div className="field">
                <label className="label" htmlFor="accountName">
                  Tên chủ tài khoản
                </label>
                <input
                  id="accountName"
                  className="input"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="accountNumber">
                  Số tài khoản
                </label>
                <input
                  id="accountNumber"
                  className="input"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={
                  busy === "saveAccount" ||
                  !bankId.trim() ||
                  !accountName.trim() ||
                  !accountNumber.trim()
                }
                onClick={() =>
                  act("saveAccount", async () => {
                    const newAccount = {
                      bankId,
                      accountName: accountName.trim(),
                      accountNumber: accountNumber.trim(),
                    };
                    await apiJson("/api/user/bank-account", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(newAccount),
                    });
                    setBankAccount(newAccount);
                    setNotice("Đã lưu thông tin tài khoản.");
                  })
                }
              >
                {busy === "saveAccount" ? (
                  <><IconSpinner size={ICON_SIZE.sm} /> Đang lưu...</>
                ) : "Lưu thông tin"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Nhóm */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Nhóm</h2>
        </div>

        {group && (
          <div className="card card-pad stack" style={{ marginBottom: 12 }}>
            <div className="row">
              <span>
                <strong>{group.name}</strong>
                <span className="faint" style={{ display: "block" }}>
                  Mã mời <span className="code">{group.inviteCode}</span>
                </span>
              </span>
              <span className="spacer" />
              <CopyButton label="Copy mã" text={group.inviteCode} />
            </div>
            <p className="hint">
              Gửi mã này cho người khác, họ nhập ở phần “Vào nhóm bằng mã mời” là
              tham gia được.
            </p>
          </div>
        )}

        <div className="card card-pad stack">
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
      </section>

      {/* Thành viên */}
      {group && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Thành viên ({members.length})</h2>
          </div>
          <div className="card">
            <ul className="ledger">
              {members.map((m) => (
                <li key={m.userId}>
                  <div className="entry" style={{ cursor: "default" }}>
                    <span className="entry-main">
                      <span className="entry-title">
                        {m.name}
                        {m.userId === user.id && (
                          <span className="tag tag-blue" style={{ marginLeft: 6 }}>
                            Bạn
                          </span>
                        )}
                        {m.role === "admin" && (
                          <span className="tag" style={{ marginLeft: 6 }}>
                            Quản trị
                          </span>
                        )}
                      </span>
                      <span className="faint" style={{ display: "block" }}>
                        {m.email}
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
                        <IconTrash size={ICON_SIZE.sm} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {isAdmin && (
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
                  disabled={
                    busy === "addMember" || !memberName.trim() || !memberEmail.trim()
                  }
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

      {/* Backup */}
      {group && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Sao lưu dữ liệu</h2>
          </div>
          <div className="card card-pad stack">
            <div className="row-wrap">
              <a
                className="btn btn-sm"
                href={`/api/groups/${group.id}/export?format=csv`}
              >
                <IconFileCsv size={ICON_SIZE.sm} /> Tải CSV bill
              </a>
              <a
                className="btn btn-sm"
                href={`/api/groups/${group.id}/export?format=csv-settlements`}
              >
                <IconFileCsv size={ICON_SIZE.sm} /> Tải CSV thanh toán
              </a>
            </div>
            {/*
              Khối "Sao lưu lên GitHub" đã ẩn khỏi UI theo yêu cầu: backup DB
              chạy hoàn toàn tự động qua crontab gọi /api/cron/backup. Endpoint
              /api/backup-db vẫn còn để gọi tay khi cần debug.
            */}
          </div>
        </section>
      )}

      {/* ponytail: section Trợ lý AI ẩn khỏi UI — hiện lại khi cần debug AI config */}
    </div>
    </PullToRefresh>
  );
}
