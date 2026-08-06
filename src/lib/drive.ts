import crypto from "node:crypto";
import { HttpError } from "./auth";

/**
 * Upload file lên Google Drive bằng service account.
 * Tự ký JWT rồi đổi lấy access token qua REST, không cần thư viện googleapis.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(
    /\\n/g,
    "\n"
  );

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  let signature: string;
  try {
    signature = b64url(signer.sign(key));
  } catch {
    throw new HttpError(
      500,
      "Private key của service account không đọc được. Kiểm tra lại biến GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      502,
      `Google từ chối cấp token (${res.status}). ${detail.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new HttpError(502, "Google không trả access token.");
  return data.access_token;
}

export async function uploadToDrive(args: {
  name: string;
  mimeType: string;
  content: string;
}): Promise<{ id: string; name: string; webViewLink?: string }> {
  if (!driveConfigured())
    throw new HttpError(
      503,
      "Chưa cấu hình Google Drive. Cần GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY và GOOGLE_DRIVE_FOLDER_ID."
    );

  const token = await getAccessToken();
  const boundary = "poco" + crypto.randomBytes(8).toString("hex");

  const metadata = {
    name: args.name,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
  };

  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${args.mimeType}; charset=UTF-8\r\n\r\n` +
    args.content +
    `\r\n--${boundary}--\r\n`;

  const res = await fetch(UPLOAD_URL + "&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      502,
      `Upload lên Drive thất bại (${res.status}). ${detail.slice(0, 300)}`
    );
  }

  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}
