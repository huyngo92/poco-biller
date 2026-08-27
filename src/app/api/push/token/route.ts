import { requireUser } from "@/lib/auth";
import { savePushToken, removePushToken } from "@/lib/queries";
import { fail, ok, str } from "@/lib/api";

/** Đăng ký token FCM mới (hoặc cập nhật nếu token đã tồn tại). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const token = str(body.token, "token", 4096);
    savePushToken(user.id, token);
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

/** Huỷ đăng ký token (khi user tắt notification hoặc gỡ app). */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const token = str(body.token, "token", 4096);
    removePushToken(user.id, token);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}