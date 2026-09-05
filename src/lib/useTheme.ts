"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (window.localStorage.getItem("poco-theme") as Theme) || "system";
    }
    return "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const storedTheme = localStorage.getItem("poco-theme") as Theme || "system";

    const applyTheme = (t: Theme) => {
      if (t === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", isDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", t);
      }
    };

    applyTheme(theme);
    window.localStorage.setItem("poco-theme", theme);

    // Lắng nghe thay đổi theme hệ thống nếu đang ở chế độ "system"
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  return { theme, setTheme };
}