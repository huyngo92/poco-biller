"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiJson } from "./client";
import {
  requestNotificationPermission,
  onForegroundMessage,
} from "./firebase-client";

type PushStatus = "unsupported" | "denied" | "granted" | "loading";

/**
 * Hook quản lý push notification ở mức client:
 * - Đăng ký service worker từ route /firebase-messaging-sw
 * - Đăng ký token khi user đã đăng nhập và đã cấp quyền.
 * - Bật/tắt notification.
 * - Lắng nghe message foreground để báo cho app (optional).
 */
export function usePushNotifications(onForeground?: (title: string, body: string) => void) {
  const { status: authStatus } = useSession();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [enabled, setEnabled] = useState(false);

  // Đăng ký service worker từ route (inject config từ env).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/firebase-messaging-sw")
      .catch((e) => console.warn("[poco-biller] SW registration failed:", e));
  }, []);

  // Lưu token lên server khi có.
  const saveToken = useCallback(async (token: string) => {
    try {
      await apiJson("/api/push/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setEnabled(true);
      return true;
    } catch (e) {
      console.error("[poco-biller] Không lưu được FCM token:", e);
      return false;
    }
  }, []);

  const enable = useCallback(async () => {
    if (authStatus !== "authenticated") return false;
    setStatus("loading");
    const token = await requestNotificationPermission();
    if (!token) {
      setStatus(Notification.permission === "denied" ? "denied" : "unsupported");
      return false;
    }
    const ok = await saveToken(token);
    setStatus(ok ? "granted" : "unsupported");
    return ok;
  }, [authStatus, saveToken]);

  const disable = useCallback(async () => {
    setEnabled(false);
    setStatus("denied");
  }, []);

  // Đăng ký foreground listener một lần.
  useEffect(() => {
    if (!onForeground) return;
    let unsub: (() => void) | null = null;
    let mounted = true;
    onForegroundMessage((payload) => {
      if (!mounted) return;
      const title = payload.notification?.title || payload.data?.title || "Poco Biller";
      const body = payload.notification?.body || payload.data?.body || "";
      onForeground(title, body);
    }).then((fn) => {
      if (mounted) unsub = fn;
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [onForeground]);

  return { status, enabled, enable, disable };
}