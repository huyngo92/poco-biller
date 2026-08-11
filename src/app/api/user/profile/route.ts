import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fail, ok, str } from "@/lib/api";

/** PATCH — cập nhật tên hiển thị và/hoặc avatar */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const db = getDb();

    if (body.name !== undefined) {
      const name = str(body.name, "tên hiển thị", 60);
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, user.id);
    }

    if (body.avatar !== undefined) {
      const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 40) : "";
      db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, user.id);
    }

    const updated = db
      .prepare("SELECT name, avatar FROM users WHERE id = ?")
      .get(user.id) as { name: string; avatar: string };
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

/** POST — đổi mật khẩu (cần mật khẩu cũ) */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const db = getDb();

    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as { password_hash: string | null } | undefined;

    if (!row) return fail(new Error("Không tìm thấy tài khoản."));

    // Nếu tài khoản chưa có mật khẩu (SSO), cho phép đặt mới không cần mật khẩu cũ
    if (row.password_hash) {
      const currentPw = str(body.currentPassword, "mật khẩu hiện tại", 100);
      if (!verifyPassword(currentPw, row.password_hash)) {
        return ok({ error: "Mật khẩu hiện tại không đúng." }, 400);
      }
    }

    const newPw = str(body.newPassword, "mật khẩu mới", 100);
    if (newPw.length < 6) {
      return ok({ error: "Mật khẩu mới cần ít nhất 6 ký tự." }, 400);
    }

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(newPw),
      user.id
    );

    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
