import { cookies } from "next/headers";
import { clearSessionCookie, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function POST() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) destroySession(token);
    await clearSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
