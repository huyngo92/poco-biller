import { requireUser } from "@/lib/auth";
import { createGroup, joinGroup, listGroupsOfUser } from "@/lib/queries";
import { fail, ok, str } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ groups: listGroupsOfUser(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (body.inviteCode) {
      const group = joinGroup(user.id, str(body.inviteCode, "mã mời", 20));
      return ok({ group }, 201);
    }

    const group = createGroup(user.id, str(body.name, "tên nhóm", 80));
    return ok({ group }, 201);
  } catch (e) {
    return fail(e);
  }
}
