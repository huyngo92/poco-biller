import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getDb } from "./db";

import type { SessionUser } from "./types";


export type { SessionUser };

// Giữ lại các hàm xử lý mật khẩu cho luồng đăng nhập cũ
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

/**
 * Lấy thông tin người dùng đang đăng nhập ở phía server.
 * An toàn để dùng trong Server Components.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  // ID người dùng được thêm vào từ callback `session` trong authOptions
  return (session?.user as SessionUser) ?? null;
}

/** Dùng trong API Route hoặc Server Component để yêu cầu đăng nhập. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Yêu cầu đăng nhập.");
  return user;
}

/** Yêu cầu người dùng phải là Super Admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const superAdmins = process.env.SUPER_ADMIN_EMAILS?.split(",") || [];
  if (!superAdmins.includes(user.email)) throw new HttpError(403, "Yêu cầu quyền Super Admin.");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
