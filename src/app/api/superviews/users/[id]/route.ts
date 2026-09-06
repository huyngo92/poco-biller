import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateUserEmail, updateUserPassword } from "@/lib/queries";
import { hashPassword } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const userId = Number(id);
    const body = await request.json();
    const { email, password } = body;

    if (email) {
      updateUserEmail(userId, email);
    }

    if (password) {
      const hash = hashPassword(password);
      updateUserPassword(userId, hash);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
