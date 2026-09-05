import { fail, ok } from "@/lib/api";
import { getSystemStats, updateGroupName } from "@/lib/queries";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

async function checkAdmin(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;

  const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
  return adminEmails.includes(session.user.email);
}

export async function GET(req: Request) {
  try {
    if (!(await checkAdmin(req))) {
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
    if (!(await checkAdmin(req))) {
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
