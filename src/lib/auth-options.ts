import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { createGroup } from "@/lib/queries";
import { verifyPassword } from "./auth";

/**
 * Theo logic trong SETUP.md, người dùng mới sẽ được tự động tạo một nhóm.
 * Hàm này tái tạo lại logic đó cho người dùng đăng nhập qua Google.
 */
function createInitialGroupForNewUser(userId: number, userName: string | null) {
  try {
    const groupName = `Nhóm của ${userName || "bạn"}`;
    createGroup(userId, groupName);
    console.log(`Đã tạo nhóm ban đầu cho người dùng mới (ID: ${userId})`);
  } catch (error) {
    console.error(`Lỗi khi tạo nhóm ban đầu cho người dùng (ID: ${userId})`, error);
    // Không chặn đăng nhập nếu tạo nhóm lỗi, người dùng có thể tự tạo sau.
  }
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong file .env");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      // Các biến này đã được kiểm tra ở trên.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Email & Mật khẩu",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        const user = getDb()
          .prepare(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?"
          )
          .get(credentials.email) as
          | { id: number; name: string; email: string; password_hash: string | null }
          | undefined;

        if (user && user.password_hash && verifyPassword(credentials.password, user.password_hash)) {
          return { id: String(user.id), name: user.name, email: user.email };
        }
        return null;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers like Google, we need to ensure the user exists in our DB.
      if (account?.provider === "google") {
        if (!user.email) {
          console.error("Google sign-in failed: email not provided.");
          return false; // Google sign-in requires an email.
        }

        const db = getDb();
        const existingUser = db
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(user.email) as { id: number } | undefined;

        if (!existingUser) {
          // New user -> create account in DB. Password will be NULL.
          const result = db
            .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
            .run(user.name, user.email);

          const newUserId = Number(result.lastInsertRowid);
          createInitialGroupForNewUser(newUserId, user.name ?? null);
        }
      }
      // For credentials, `authorize` has already run. For Google, we've just synced the user.
      // Allow the sign-in to proceed.
      return true;
    },
    async jwt({ token }) {
      // Thêm ID người dùng từ CSDL vào JWT token
      const dbUser = getDb()
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(token.email) as { id: number } | undefined;
      if (dbUser) token.sub = String(dbUser.id);
      return token;
    },
    async session({ session, token }) {
      // Thêm ID người dùng vào đối tượng session để dùng ở mọi nơi
      if (session.user && token.sub) (session.user as any).id = parseInt(token.sub, 10);
      return session;
    },
  },
  pages: {
    signIn: "/dang-nhap", // Chuyển hướng tới trang đăng nhập tùy chỉnh
  },
};