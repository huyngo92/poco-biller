import { HttpError } from "./auth";
import {
  type ContentBlock,
  describeFetchFailure,
  redactSecrets,
} from "./ai-shared";

/**
 * Cấu hình Google Gemini qua biến môi trường, cùng kiểu với ANTHROPIC_* trong claude.ts.
 *
 * GEMINI_BASE_URL   gốc endpoint, mặc định https://generativelanguage.googleapis.com
 * GEMINI_MODEL      tên model, mặc định gemini-2.0-flash (đọc được ảnh)
 * GEMINI_MAX_TOKENS trần token đầu ra (mặc định 2000)
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-flash-latest";
const DEFAULT_MAX_TOKENS = 2000;

const FETCH_TIMEOUT_MS = (() => {
  const v = Number(process.env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(v) && v >= 1000 ? Math.floor(v) : 90_000;
})();

export type GeminiConfig = {
  url: string;
  host: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  hasKey: boolean;
};

function resolveBase(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_BASE_URL;
}

export function geminiConfig(): GeminiConfig {
  const rawBase = resolveBase(process.env.GEMINI_BASE_URL?.trim() || DEFAULT_BASE_URL);
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const url = `${rawBase}/v1beta/models/${model}:generateContent`;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(
      500,
      `GEMINI_BASE_URL không phải một URL hợp lệ: "${rawBase}". Ví dụ đúng: https://generativelanguage.googleapis.com`
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new HttpError(
      500,
      `GEMINI_BASE_URL phải dùng http hoặc https, đang là "${parsed.protocol}".`
    );

  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (
    parsed.protocol === "http:" &&
    !isLocal &&
    process.env.ANTHROPIC_ALLOW_INSECURE_HTTP !== "1"
  )
    throw new HttpError(
      500,
      `GEMINI_BASE_URL đang dùng http tới ${parsed.hostname}. Nội dung hoá đơn sẽ đi qua kết nối không mã hoá. Hãy chuyển sang https, hoặc đặt ANTHROPIC_ALLOW_INSECURE_HTTP=1 nếu bạn chắc chắn đây là mạng nội bộ an toàn.`
    );

  const rawMax = Number(process.env.GEMINI_MAX_TOKENS);
  const maxTokens =
    Number.isFinite(rawMax) && rawMax > 0
      ? Math.min(Math.floor(rawMax), 64_000)
      : DEFAULT_MAX_TOKENS;

  return {
    url,
    host: parsed.host,
    model,
    maxTokens,
    timeoutMs: FETCH_TIMEOUT_MS,
    hasKey: Boolean(process.env.GEMINI_API_KEY),
  };
}

function toGeminiPart(block: ContentBlock) {
  if (block.type === "text") return { text: block.text };
  return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
}

/**
 * Gọi generateContent API và trả về phần text đầu ra.
 * Dùng fetch trực tiếp, cùng cách xử lý lỗi với askClaude() trong claude.ts.
 *
 * Key gửi qua header x-goog-api-key, không qua query string, để không lọt vào
 * access log của gateway hay proxy đứng giữa.
 */
export async function askGemini(args: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  const cfg = geminiConfig();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new HttpError(
      503,
      "Chưa cấu hình GEMINI_API_KEY nên tính năng AI tạm chưa dùng được. Bạn vẫn nhập bill thủ công bình thường."
    );

  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: args.content.map(toGeminiPart) }],
        generationConfig: { maxOutputTokens: args.maxTokens ?? cfg.maxTokens },
      }),
    });
  } catch (e) {
    throw new HttpError(502, describeFetchFailure(e, cfg.host, FETCH_TIMEOUT_MS));
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      502,
      `${cfg.host} trả lỗi ${res.status} với model "${cfg.model}". ${redactSecrets(
        detail.slice(0, 300)
      )}`
    );
  }

  const bodyText = await res.text();
  console.log(`[AI Response] provider: gemini, model: ${cfg.model}, status: ${res.status}`);
  console.log(redactSecrets(bodyText.slice(0, 2000)));

  let data: { candidates?: { content: { parts: { text: string }[] } }[] };
  try {
    data = JSON.parse(bodyText) as typeof data;
  } catch {
    throw new HttpError(
      502,
      `${cfg.host} trả về nội dung không phải JSON. Đoạn đầu phản hồi: ${redactSecrets(
        bodyText.slice(0, 200).replace(/\s+/g, " ").trim()
      )}`
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  if (!text) {
    const detail = `Model "${cfg.model}" không trả về nội dung nào. Cấu trúc nhận được: ${redactSecrets(
      JSON.stringify(data).slice(0, 500)
    )}`;
    console.error(`[AI Error] ${detail}`);
    throw new HttpError(502, detail);
  }

  return text;
}
