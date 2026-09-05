"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/useTheme";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme(); // Chỉ cần gọi để khởi tạo logic apply theme từ localStorage
  return <>{children}</>;
}