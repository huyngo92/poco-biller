import { getDb } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { assertMember, listMembers, removeMember, listPushTokensForGroup } from "@/lib/queries";
import { fail, num, ok, str } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { sendPushToMany } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    assertMember(groupId, user.id);
    return ok({ members: listMembers(groupId) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Admin thêm nhanh một thành viên chưa có tài khoản: tạo user với mật khẩu
 * tạm rồi đưa vào nhóm. Người đó đăng nhập bằng email + mật khẩu tạm.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    const role = assertMember(groupId, user.id);
    if (role !== "admin")
      throw new HttpError(403, "Chỉ quản trị nhóm mới thêm được thành viên.");

    const body = await req.json();
    const name = str(body.name, "tên", 80);
    const email = str(body.email, "email", 200).toLowerCase();
    const tempPassword =
      typeof body.password === "string" && body.password.length >= 6
        ? body.password
        : Math.random().toString(36).slice(2, 10);

    const db = getDb();
    let userId: number;
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
      | { id: number }
      | undefined;

    if (existing) {
      userId = existing.id;
    } else {
      const info = db
        .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
        .run(email, name, hashPassword(tempPassword));
      userId = Number(info.lastInsertRowid);
    }

    db.prepare(
      "INSERT OR IGNORE INTO memberships (group_id, user_id, role) VALUES (?, ?, 'member')"
    ).run(groupId, userId);

    // Báo các thành viên khác trong nhóm có người mới tham gia.
    void sendPushToMany(
      listPushTokensForGroup(groupId, user.id),
      {
        title: "Thành viên mới",
        body: `${name} vừa tham gia nhóm`,
        link: "/cai-dat/thanh-vien",
      }
    );

    return ok(
      {
        members: listMembers(groupId),
        tempPassword: existing ? null : tempPassword,
      },
      201
    );
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const groupId = Number((await params).id);
    const role = assertMember(groupId, user.id);
    if (role !== "admin")
      throw new HttpError(403, "Chỉ quản trị nhóm mới xoá được thành viên.");

    const body = await req.json();
    const targetId = num(body.userId, "userId");
    if (targetId === user.id)
      throw new HttpError(400, "Không thể tự xoá mình khỏi nhóm.");

    removeMember(groupId, targetId);
    return ok({ members: listMembers(groupId) });
  } catch (e) {
    return fail(e);
  }
}
