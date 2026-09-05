"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { requestNotificationPermission } from "@/lib/firebase-client";
import { apiJson } from "@/lib/client";

export default function PushRegistration() {
  const { data: session, status } = useSession();

  useEffect(() => {
    async function register() {
      if (status !== "authenticated" || !session?.user?.email) return;

      try {
        const token = await requestNotificationPermission();
        if (token) {
          await apiJson("/api/push/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          console.log("[poco-biller] Token registered successfully");
        }
      } catch (err) {
        console.error("[poco-biller] Failed to register push token:", err);
      }
    }

    void register();
  }, [session, status]);

  return null;
}
