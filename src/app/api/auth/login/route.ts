import { getDb } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
  HttpError,
} from "@/lib/auth";
import { fail, ok, str } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = str(body.email, "email", 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    const row = getDb()
      .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
      .get(email) as
      | { id: number; email: string; name: string; password_hash: string }
      | undefined;

    // Cùng một thông báo cho email sai và mật khẩu sai
    if (!row || !verifyPassword(password, row.password_hash))
      throw new HttpError(401, "Email hoặc mật khẩu không đúng.");

    const { token, expires } = createSession(row.id);
    await setSessionCookie(token, expires);
    return ok({ user: { id: row.id, email: row.email, name: row.name } });
  } catch (e) {
    return fail(e);
  }
}
