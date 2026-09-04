import { fail, ok } from "@/lib/api";
import { getSystemStats, updateGroupName } from "@/lib/queries";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Basic ${Buffer.from(`${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`).toString("base64")}`) {
      return fail(new Error("Unauthorized"), 401);
    }

    const stats = getSystemStats();
    return ok(stats);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Basic ${Buffer.from(`${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`).toString("base64")}`) {
      return fail(new Error("Unauthorized"), 401);
    }

    const body = await req.json();
    const groupId = Number(body.groupId);
    const name = String(body.name);

    if (!groupId || !name) return fail(new Error("Thiếu thông tin groupId hoặc name"), 400);

    updateGroupName(groupId, name);
    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}
