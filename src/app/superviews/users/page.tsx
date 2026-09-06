"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/superviews/users")
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          router.push("/superviews");
        } else {
          setUsers(data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpdateUser() {
    const res = await fetch(`/api/superviews/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) {
      alert("Cập nhật thành công!");
      setEmail("");
      setPassword("");
      // Refresh users list
      const usersRes = await fetch("/api/superviews/users");
      setUsers(await usersRes.json());
    } else {
      alert(data.error);
    }
  }

  async function loadTokens(userId: number) {
    const res = await fetch(`/api/superviews/tokens?userId=${userId}`);
    const data = await res.json();
    setTokens(data);
    setSelectedUser({ id: userId });
  }

  async function deleteToken(token: string) {
    const res = await fetch(`/api/superviews/tokens?token=${token}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setTokens(tokens.filter(t => t !== token));
    } else {
      alert(data.error);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Quản lý Người dùng</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
            <th>ID</th>
            <th>Tên</th>
            <th>Email</th>
            <th>Admin</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.is_admin ? "✅" : "❌"}</td>
              <td>
                <button onClick={() => loadTokens(u.id)} style={{ marginRight: 10 }}>Token</button>
                <button onClick={() => {
                  setSelectedUser(u);
                  setEmail(u.email);
                  setPassword("");
                }}>Sửa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <div style={{
          marginTop: 30,
          padding: 20,
          border: "1px solid #ccc",
          borderRadius: 8,
          backgroundColor: "#f9f9f9"
        }}>
          <h3>Quản lý người dùng: {selectedUser.name} (ID: {selectedUser.id})</h3>

          <div style={{ marginBottom: 20 }}>
            <h4>Cập nhật tài khoản</h4>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email mới"
              style={{ display: "block", marginBottom: 10, padding: 5 }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mật khẩu mới (để trống nếu không đổi)"
              style={{ display: "block", marginBottom: 10, padding: 5 }}
            />
            <button onClick={handleUpdateUser}>Lưu thay đổi</button>
            <button onClick={() => setSelectedUser(null)} style={{ marginLeft: 10 }}>Hủy</button>
          </div>

          <div>
            <h4>Push Tokens</h4>
            {tokens.length === 0 ? <p>Không có token nào.</p> : (
              <ul>
                {tokens.map(t => (
                  <li key={t} style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: "12px", wordBreak: "break-all" }}>{t}</span>
                    <button
                      onClick={() => deleteToken(t)}
                      style={{ marginLeft: 10, color: "red", fontSize: "12px" }}
                    >
                      Xoá
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
