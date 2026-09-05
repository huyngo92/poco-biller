/**
 * Firebase client SDK — dùng ở browser để:
 * 1. Xin quyền notification
 * 2. Lấy FCM registration token
 * 3. Lắng nghe message foreground
 *
 * Config đọc từ biến môi trường NEXT_PUBLIC_*, được set trong .env.
 * Khi chưa cấu hình (thiếu biến), các hàm trả về null / skip — app vẫn chạy bình thường.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

let app: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

function isConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && vapidKey);
}

/** Khởi tạo Firebase app (chạy 1 lần). Trả về null nếu chưa cấu hình. */
export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  if (!isConfigured()) return null;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/** Lấy Messaging instance. Trả về null nếu chưa cấu hình hoặc browser không hỗ trợ. */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  messagingInstance = getMessaging(firebaseApp);
  return messagingInstance;
}

/**
 * Xin quyền notification và lấy FCM token.
 * Trả về token string, hoặc null nếu từ chối / chưa cấu hình / không hỗ trợ.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    // Đảm bảo SW đã được đăng ký và sẵn sàng
    const registration = await navigator.serviceWorker.ready;

    // Lấy token. Lưu ý: getToken sẽ sử dụng SW hiện tại của browser.
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    return token;
  } catch (err) {
    console.error("[poco-biller] Lỗi lấy FCM token:", err);
    return null;
  }
}

/** Lắng nghe message khi app đang mở (foreground). */
export async function onForegroundMessage(
  callback: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, callback);
}