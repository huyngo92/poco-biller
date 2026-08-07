import { getDb } from "@/lib/db";
import { hashPassword, HttpError } from "@/lib/auth";
import { createGroup } from "@/lib/queries";
import { fail, ok, str } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name, "tên", 80);
    const email = str(body.email, "email", 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Email chưa đúng định dạng.");
    if (password.length < 6)
      throw new HttpError(400, "Mật khẩu cần ít nhất 6 ký tự.");

    const db = getDb();
    const existing = db.prepare("SELECT 1 FROM users WHERE email = ?").get(email);
    if (existing) throw new HttpError(409, "Email này đã có tài khoản.");

    const info = db
      .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
      .run(email, name, hashPassword(password));
    const userId = Number(info.lastInsertRowid);

    // Người mới luôn có sẵn một nhóm để bắt đầu ghi bill ngay
    createGroup(userId, `Nhóm của ${name}`);

    // ponytail: register giờ chỉ tạo user, client tự signIn("credentials") sau đó.
    return ok({ user: { id: userId, email, name } }, 201);
  } catch (e) {
    return fail(e);
  }
}
