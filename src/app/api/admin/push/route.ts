import { NextResponse } from "next/server";
import { fail, ok, str, num } from "@/lib/api";
import {
  listAllPushTokens,
  listPushTokensForGroup,
  scheduleNotification,
  getPendingNotifications,
  markNotificationStatus
} from "@/lib/queries";
import { sendPushToMany } from "@/lib/push";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

async function authenticateAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Thiếu xác thực Admin.");
  }
  const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
  if (!adminEmails.includes(session.user.email)) {
    throw new Error("Thông tin Admin không chính xác.");
  }
}

export async function GET(req: Request) {
  try {
    await authenticateAdmin();
    const pending = getPendingNotifications();
    return ok({ scheduled: pending });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await authenticateAdmin();
    const body = await req.json();
    const title = str(body.title, "tiêu đề");
    const bodyText = str(body.body, "nội dung");
    const targetType = body.targetType === "group" ? "group" : "all";
    const targetId = targetType === "group" ? num(body.targetId, "groupId") : null;
    const sendAt = body.sendAt;

    if (sendAt) {
      const id = scheduleNotification({ title, body: bodyText, targetType, targetId, sendAt });
      return ok({ scheduledId: id, status: "scheduled" }, 201);
    } else {
      let tokens: string[] = targetType === "all" ? listAllPushTokens() : listPushTokensForGroup(targetId!);
      if (tokens.length === 0) return ok({ status: "no_tokens" }, 200);
      void sendPushToMany(tokens, { title, body: bodyText, link: "/" });
      return ok({ status: "sent", count: tokens.length }, 200);
    }
  } catch (e) {
    return fail(e);
  }
}
