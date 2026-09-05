/**
 * Gửi push notification bằng Firebase Admin SDK — chạy phía server (Node runtime).
 *
 * firebase-admin được import ĐỘNG bên trong hàm để không kéo package này vào
 * bundle edge/webpack trace của các route (giống cách ./db, ./backup import động
 * trong scheduler.ts để tránh vòng lặp module và kéo better-sqlite3 vào edge).
 *
 * Service account đọc từ biến môi trường. Hai cách cấu hình:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON — dán toàn bộ JSON của service account key
 *     (gọn nhất cho self-host, không cần file riêng).
 *  2. FIREBASE_SERVICE_ACCOUNT_PATH — đường dẫn tới file serviceAccountKey.json.
 */

type PushPayload = {
  title: string;
  body?: string;
  /** Đường dẫn mở khi người dùng bấm vào notification, ví dụ "/nhac-no". */
  link?: string;
};

let initialized = false;
let initError: string | null = null;

function serviceAccount(): object | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      initError = "FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ.";
      return null;
    }
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (path) return { projectId: process.env.FIREBASE_PROJECT_ID, keyFilename: path };
  return null;
}

/** Khởi tạo firebase-admin một lần. Trả về app, hoặc null nếu chưa cấu hình. */
async function getAdminApp() {
  if (initialized) {
    const { admin, messaging } = await getAdminAppInternal();
    return { admin, messaging };
  }

  const cred = serviceAccount();
  if (!cred) {
    initError =
      "Chưa cấu hình Firebase: cần FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_SERVICE_ACCOUNT_PATH.";
    initialized = true;
    return null;
  }

  const { cert, getApps, getApp, initializeApp } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");

  let admin;
  if (getApps().length > 0) {
    admin = getApp();
  } else {
    admin = initializeApp({ credential: cert(cred as any) });
  }
  initialized = true;
  return { admin, messaging: getMessaging(admin) };
}

/** Gửi push tới một token. Lỗi sẽ được ghi log và nuốt — không làm hỏng request chính. */
export async function sendPush(token: string, payload: PushPayload): Promise<void> {
  try {
    const app = await getAdminApp();
    if (!app) return;

    await app.messaging.send({
      token,
      notification: { title: payload.title, body: payload.body ?? "" },
      webpush: {
        fcmOptions: { link: payload.link },
      },
    });
  } catch (e) {
    // Token có thể đã hết hạn / bị thu hồi — không nên làm fail request chính.
    console.warn("[poco-biller] Gửi push thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Gửi push tới nhiều token cùng lúc. */
export async function sendPushToMany(tokens: string[], payload: PushPayload): Promise<void> {
  const app = await getAdminApp();
  if (!app || tokens.length === 0) return;

  // Loại bỏ token rỗng và trùng lặp.
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return;

  try {
    await app.messaging.sendEachForMulticast({
      tokens: unique,
      notification: { title: payload.title, body: payload.body ?? "" },
      webpush: { fcmOptions: { link: payload.link } },
    });
  } catch (e) {
    console.warn("[poco-biller] Gửi push hàng loạt thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Trả về lý do chưa cấu hình Firebase (để báo cho người phát triển), hoặc null nếu đã sẵn sàng. */
export function pushConfigProblem(): string | null {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    return "Thiếu FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_SERVICE_ACCOUNT_PATH.";
  return null;
}