import { fail, ok } from "@/lib/api";

export async function POST() {
  try {
    // ponytail: logout giờ do NextAuth xử lý qua signOut() ở client.
    // Route này giữ lại cho backward-compat.
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
