import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSystemStats, updateGroupName } from "@/lib/queries";

export async function GET() {
  try {
    await requireAdmin();
    const stats = getSystemStats();
    return NextResponse.json(stats);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { groupId, name } = body;

    if (!groupId || !name) throw new Error("Thiếu thông tin cập nhật.");

    updateGroupName(groupId, name);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
