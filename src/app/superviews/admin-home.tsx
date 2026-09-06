import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const superAdmins = process.env.SUPER_ADMIN_EMAILS?.split(",") || [];
  if (!superAdmins.includes(user.email)) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <h1>403 - Truy cập bị từ chối</h1>
        <p>Bạn không có quyền truy cập vào khu vực quản trị.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Quản trị Hệ thống (Super Admin)</h1>
      <div style={{ marginTop: 20 }}>
        <a href="/super/users" style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          textDecoration: "none",
          borderRadius: 4
        }}>
          Quản lý Người dùng
        </a>
      </div>
    </div>
  );
}
