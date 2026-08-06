import { requireUser } from "@/lib/auth";
import { banks } from "@/lib/banks";
import { fail, ok } from "@/lib/api";

/** Danh sách ngân hàng tĩnh dùng để chọn trong form "Thông tin thanh toán". */
export async function GET() {
  try {
    await requireUser();
    return ok({ banks });
  } catch (e) {
    return fail(e);
  }
}
