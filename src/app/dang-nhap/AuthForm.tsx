"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Mascot from "@/components/Mascot";
import { IconAlert, IconSpinner, ICON_SIZE } from "@/components/Icons";

type Mode = "login" | "register";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
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
      if (mode === "login") {
        const result = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });
        if (result?.error) {
          setError("Email hoặc mật khẩu không đúng.");
        } else if (result?.ok) {
          router.replace(callbackUrl);
          router.refresh();
        }
      } else {
        // Đăng ký tài khoản mới qua API riêng
        const res = await fetch(`/api/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Không tạo được tài khoản.");
          return;
        }
        // Đăng ký xong thì tự động đăng nhập
        const loginResult = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });
        if (loginResult?.ok) {
          router.replace(callbackUrl);
          router.refresh();
        } else {
          setError("Tạo tài khoản thành công. Vui lòng đăng nhập.");
          setMode("login");
        }
      }
    } catch {
      setError("Không kết nối được tới máy chủ. Bạn thử lại giúp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ paddingBottom: 40, paddingTop: 56 }}>
      <div className="auth-hero">
        <Mascot name="celebrate" size={132} />
        <div className="row" style={{ justifyContent: "center", gap: 8, alignItems: "center" }}>
          <img src="/favicon.ico" alt="Logo" width={24} height={24} style={{ borderRadius: 4 }} />
          <span className="brand">Poco Biller</span>
        </div>
        <h1 style={{ marginTop: 14, marginBottom: 4 }}>
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "18px 0",
          color: "var(--label-tertiary)",
        }}
      >
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--rule)" }} />
        <span>hoặc</span>
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--rule)" }} />
      </div>

      <button
        className="btn btn-block"
        onClick={() => signIn("google", { callbackUrl })}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Đăng nhập với Google
      </button>

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
