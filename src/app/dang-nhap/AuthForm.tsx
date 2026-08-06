"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlert, IconSpinner, ICON_SIZE } from "@/components/Icons";

type Mode = "login" | "register";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { name, email, password } : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không đăng nhập được.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Không kết nối được tới máy chủ. Bạn thử lại giúp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ paddingBottom: 40, paddingTop: 56 }}>
      <div style={{ marginBottom: 26 }}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand">Poco Biller</span>
        <h1 style={{ marginTop: 18 }}>
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Ghi bill, chia tiền, và biết chính xác ai còn nợ ai.
        </p>
      </div>

      <form className="card card-pad stack" onSubmit={submit}>
        {mode === "register" && (
          <div className="field">
            <label className="label" htmlFor="name">
              Tên của bạn
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ngô Long Huy"
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
          {mode === "register" && (
            <span className="hint">Ít nhất 6 ký tự.</span>
          )}
        </div>

        {error && (
          <p className="error" role="alert">
            <IconAlert size={ICON_SIZE.sm} />
            <span>{error}</span>
          </p>
        )}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? (
            <>
              <IconSpinner size={ICON_SIZE.md} /> Đang xử lý
            </>
          ) : mode === "login" ? (
            "Đăng nhập"
          ) : (
            "Tạo tài khoản"
          )}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", marginTop: 18 }}>
        {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
        <button
          type="button"
          className="link"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Tạo tài khoản mới" : "Đăng nhập"}
        </button>
      </p>
    </div>
  );
}
