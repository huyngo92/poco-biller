import { HttpError } from "./auth";
import {
  type ContentBlock,
  describeFetchFailure,
  redactSecrets,
} from "./ai-shared";

/**
 * Cấu hình OpenAI qua biến môi trường, cùng kiểu với ANTHROPIC_* trong claude.ts.
 *
 * OPENAI_BASE_URL   gốc endpoint, mặc định https://api.openai.com
 * OPENAI_MODEL      tên model, mặc định gpt-4o-mini (đọc được ảnh)
 * OPENAI_MAX_TOKENS trần token đầu ra (mặc định 2000)
 */
const DEFAULT_BASE_URL = "https://api.openai.com";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 2000;

const FETCH_TIMEOUT_MS = (() => {
  const v = Number(process.env.OPENAI_TIMEOUT_MS);
  return Number.isFinite(v) && v >= 1000 ? Math.floor(v) : 90_000;
})();

export type OpenAiConfig = {
  url: string;
  host: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  hasKey: boolean;
};

/**
 * Ghép base URL thành endpoint chat/completions, cùng cách chuẩn hoá với
 * resolveMessagesUrl() của claude.ts:
 *
 *   https://host                      → https://host/v1/chat/completions
 *   https://host/v1                    → https://host/v1/chat/completions
 *   https://host/v1/chat/completions   → giữ nguyên
 */
export function resolveChatCompletionsUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return `${DEFAULT_BASE_URL}/v1/chat/completions`;
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export function openAiConfig(): OpenAiConfig {
  const raw = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = resolveChatCompletionsUrl(raw);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(
      500,
      `OPENAI_BASE_URL không phải một URL hợp lệ: "${raw}". Ví dụ đúng: https://api.openai.com`
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new HttpError(
      500,
      `OPENAI_BASE_URL phải dùng http hoặc https, đang là "${parsed.protocol}".`
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
      `OPENAI_BASE_URL đang dùng http tới ${parsed.hostname}. Nội dung hoá đơn sẽ đi qua kết nối không mã hoá. Hãy chuyển sang https, hoặc đặt ANTHROPIC_ALLOW_INSECURE_HTTP=1 nếu bạn chắc chắn đây là mạng nội bộ an toàn.`
    );

  const rawMax = Number(process.env.OPENAI_MAX_TOKENS);
  const maxTokens =
    Number.isFinite(rawMax) && rawMax > 0
      ? Math.min(Math.floor(rawMax), 64_000)
      : DEFAULT_MAX_TOKENS;

  return {
    url,
    host: parsed.host,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    maxTokens,
    timeoutMs: FETCH_TIMEOUT_MS,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

function toOpenAiPart(block: ContentBlock) {
  if (block.type === "text") return { type: "text" as const, text: block.text };
  return {
    type: "image_url" as const,
    image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
  };
}

/**
 * Gọi Chat Completions API và trả về phần text đầu ra.
 * Dùng fetch trực tiếp, cùng cách xử lý lỗi với askClaude() trong claude.ts.
 */
export async function askOpenAi(args: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  const cfg = openAiConfig();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new HttpError(
      503,
      "Chưa cấu hình OPENAI_API_KEY nên tính năng AI tạm chưa dùng được. Bạn vẫn nhập bill thủ công bình thường."
    );

  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: args.maxTokens ?? cfg.maxTokens,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.content.map(toOpenAiPart) },
        ],
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
  console.log(`[AI Response] provider: openai, model: ${cfg.model}, status: ${res.status}`);
  console.log(redactSecrets(bodyText.slice(0, 2000)));

  let data: { choices?: { message: { content: string | null } }[] };
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

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    const detail = `Model "${cfg.model}" không trả về nội dung nào. Cấu trúc nhận được: ${redactSecrets(
      JSON.stringify(data).slice(0, 500)
    )}`;
    console.error(`[AI Error] ${detail}`);
    throw new HttpError(502, detail);
  }

  return text;
}
