import { requireUser } from "@/lib/auth";
import { assertMember } from "@/lib/queries";
import { getReminders } from "@/lib/logic";
import { fail, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    assertMember(groupId, user.id);
    return ok({ reminders: getReminders(groupId) });
  } catch (e) {
    return fail(e);
  }
}
