import { requireUser } from "@/lib/auth";
import { deleteBill } from "@/lib/queries";
import { fail, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    deleteBill(Number((await params).id), user.id);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
