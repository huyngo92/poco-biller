import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listTokensForUser, deletePushToken } from "@/lib/queries";

export async function GET(
  request: NextRequest
) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) throw new Error("Thiếu userId.");

    const tokens = listTokensForUser(Number(userId));
    return NextResponse.json(tokens);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) throw new Error("Thiếu token.");

    deletePushToken(token);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
