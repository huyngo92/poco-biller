import { HttpError, requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { importIntoGroup, type BackupPayload } from "@/lib/backup";
import { fail, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    const role = assertMember(groupId, user.id);
    if (role !== "admin")
      throw new HttpError(403, "Chỉ quản trị nhóm mới nhập được dữ liệu.");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Chưa chọn file backup JSON.");
    if (file.size > 10 * 1024 * 1024)
      throw new HttpError(400, "File lớn hơn 10 MB.");

    let payload: BackupPayload;
    try {
      payload = JSON.parse(await file.text()) as BackupPayload;
    } catch {
      throw new HttpError(400, "File không phải JSON hợp lệ.");
    }

    const result = importIntoGroup(groupId, payload, user.id);
    return ok({ result });
  } catch (e) {
    return fail(e);
  }
}
