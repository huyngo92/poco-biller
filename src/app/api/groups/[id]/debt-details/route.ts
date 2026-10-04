import { requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { getDebtDetails } from "@/lib/queries";
import { fail, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    assertMember(groupId, user.id);

    const { searchParams } = new URL(req.url);
    const debtorId = Number(searchParams.get("debtorId"));
    const creditorId = Number(searchParams.get("creditorId"));

    if (!debtorId || !creditorId) {
      return fail(new Error("Thiếu debtorId hoặc creditorId."));
    }

    return ok({ details: getDebtDetails(groupId, debtorId, creditorId) });
  } catch (e) {
    return fail(e);
  }
}
