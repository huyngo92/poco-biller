"use client";

import { useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/client";
import { IconAlert, IconBack, IconGear, IconOk, IconShield, IconSpinner, ICON_SIZE } from "@/components/Icons";

export default function Security() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function changePassword() {
    setError("");
    setNotice("");
    if (newPw !== confirmPw) {
      setError("Mật khẩu mới và xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiJson<{ ok?: boolean; error?: string }>("/api/user/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setNotice("Đã đổi mật khẩu thành công.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đổi mật khẩu không thành công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/cai-dat" className="btn btn-ghost btn-icon btn-sm" aria-label="Quay lại">
          <IconBack size={ICON_SIZE.md} />
        </Link>
        <IconGear size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
        <span className="brand">Bảo mật</span>
        <span className="spacer" />
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

      <section className="section">
        <div className="card card-pad stack">
          <div className="row" style={{ gap: 8 }}>
            <IconShield size={ICON_SIZE.md} className="faint" />
            <p style={{ margin: 0, fontWeight: 700 }}>Đổi mật khẩu</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="currentPw">
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPw"
              type="password"
              className="input"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="newPw">
              Mật khẩu mới
            </label>
            <input
              id="newPw"
              type="password"
              className="input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="confirmPw">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="confirmPw"
              type="password"
              className="input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || !newPw || !confirmPw}
            onClick={() => void changePassword()}
          >
            {busy ? (
              <>
                <IconSpinner size={ICON_SIZE.sm} /> Đang đổi...
              </>
            ) : (
              "Đổi mật khẩu"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
