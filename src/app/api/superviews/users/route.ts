import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllUsers } from "@/lib/queries";

export async function GET() {
  try {
    await requireAdmin();
    const users = listAllUsers();
    return NextResponse.json(users);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
