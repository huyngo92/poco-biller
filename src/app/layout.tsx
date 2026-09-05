import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthProvider from "@/lib/AuthProvider";
import ThemeProvider from "@/lib/ThemeProvider";
import PushRegistration from "@/components/PushRegistration";

export const metadata: Metadata = {
  title: "Poco Biller — chia tiền nhóm",
  description:
    "Ghi bill, chia tiền và theo dõi ai còn nợ ai cho nhóm bạn hoặc team.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <ThemeProvider>
            <PushRegistration />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
