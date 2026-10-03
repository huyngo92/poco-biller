import { HttpError } from "./auth";
import {
  type ContentBlock,
  describeFetchFailure,
  parseSseText,
  redactSecrets,
} from "./ai-shared";

export {
  type TextBlock,
  type ImageBlock,
  type ContentBlock,
  isPublicHost,
  describeFetchFailure,
  redactSecrets,
  parseSseText,
  extractJson,
} from "./ai-shared";

/**
 * Cấu hình endpoint AI qua biến môi trường, không hard-code.
 *
 * Vì sao cần: nhiều nơi không gọi trực tiếp api.anthropic.com mà đi qua gateway
 * nội bộ (Bedrock proxy, LiteLLM, API gateway của tổ chức) để kiểm soát log và
 * chi phí. Đổi endpoint không nên phải sửa code.
 *
 * ANTHROPIC_BASE_URL  gốc endpoint, ví dụ https://api.anthropic.com
 *                     hoặc https://ai-gw.noi-bo/anthropic
 * ANTHROPIC_MODEL     tên model, ví dụ claude-sonnet-4-5
 * ANTHROPIC_MAX_TOKENS  trần token đầu ra (mặc định 2000)
 * ANTHROPIC_AUTH_STYLE  "x-api-key" (mặc định) hoặc "bearer" cho gateway chỉ
 *                     nhận Authorization: Bearer
 * ANTHROPIC_VERSION   giá trị header anthropic-version, hiếm khi cần đổi
 */

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_VERSION = "2023-06-01";

/**
 * Trần thời gian chờ mỗi lời gọi. Đặt rộng vì các dịch vụ gói miễn phí (Render,
 * Fly, Railway) ngủ khi không ai dùng và mất tới một phút để dựng lại container
 * — timeout ngắn hơn sẽ báo lỗi oan cho lần gọi đầu tiên trong ngày.
 * Đổi được bằng ANTHROPIC_TIMEOUT_MS.
 */
const FETCH_TIMEOUT_MS = (() => {
  const v = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(v) && v >= 1000 ? Math.floor(v) : 90_000;
})();

export type AiConfig = {
  /** URL đầy đủ tới endpoint messages */
  url: string;
  /** Chỉ host, dùng để hiển thị cho admin mà không lộ đường dẫn nội bộ */
  host: string;
  model: string;
  maxTokens: number;
  authStyle: "x-api-key" | "bearer";
  version: string;
  /** Trần thời gian chờ mỗi lời gọi, tính bằng ms */
  timeoutMs: number;
  hasKey: boolean;
};

/**
 * Ghép base URL thành endpoint messages. Người cấu hình có thể dán bất kỳ dạng
 * nào trong ba dạng dưới đây mà vẫn ra cùng một kết quả — nhầm ở bước này thì
 * lỗi trả về là 404 rất khó đoán, nên chuẩn hoá luôn:
 *
 *   https://host                  → https://host/v1/messages
 *   https://host/v1               → https://host/v1/messages
 *   https://host/v1/messages      → giữ nguyên
 */
export function resolveMessagesUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return `${DEFAULT_BASE_URL}/v1/messages`;
  if (/\/messages$/.test(trimmed)) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

/**
 * Đọc và kiểm tra cấu hình. Ném HttpError với thông báo tiếng Việt thay vì để
 * fetch chết với lỗi kỹ thuật khó hiểu.
 */
export function aiConfig(): AiConfig {
  const raw = process.env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = resolveMessagesUrl(raw);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(
      500,
      `ANTHROPIC_BASE_URL không phải một URL hợp lệ: "${raw}". Ví dụ đúng: https://api.anthropic.com`
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new HttpError(
      500,
      `ANTHROPIC_BASE_URL phải dùng http hoặc https, đang là "${parsed.protocol}".`
    );

  // Nội dung hoá đơn là dữ liệu riêng tư của nhóm — không đẩy qua kết nối
  // không mã hoá tới máy khác. Localhost thì không ra khỏi máy nên chấp nhận.
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
      `ANTHROPIC_BASE_URL đang dùng http tới ${parsed.hostname}. Nội dung hoá đơn sẽ đi qua kết nối không mã hoá. Hãy chuyển sang https, hoặc đặt ANTHROPIC_ALLOW_INSECURE_HTTP=1 nếu bạn chắc chắn đây là mạng nội bộ an toàn.`
    );

  const rawMax = Number(process.env.ANTHROPIC_MAX_TOKENS);
  const maxTokens =
    Number.isFinite(rawMax) && rawMax > 0
      ? Math.min(Math.floor(rawMax), 64_000)
      : DEFAULT_MAX_TOKENS;

  const styleRaw = process.env.ANTHROPIC_AUTH_STYLE?.trim().toLowerCase();
  if (styleRaw && styleRaw !== "bearer" && styleRaw !== "x-api-key")
    throw new HttpError(
      500,
      `ANTHROPIC_AUTH_STYLE chỉ nhận "x-api-key" hoặc "bearer", đang là "${styleRaw}".`
    );

  return {
    url,
    host: parsed.host,
    model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    maxTokens,
    authStyle: styleRaw === "bearer" ? "bearer" : "x-api-key",
    version: process.env.ANTHROPIC_VERSION?.trim() || DEFAULT_VERSION,
    timeoutMs: FETCH_TIMEOUT_MS,
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

/**
 * Gọi Messages API và trả về phần text đầu ra.
 * Dùng fetch trực tiếp để không phải thêm dependency.
 */
export async function askClaude(args: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  const cfg = aiConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new HttpError(
      503,
      "Chưa cấu hình ANTHROPIC_API_KEY nên tính năng AI tạm chưa dùng được. Bạn vẫn nhập bill thủ công bình thường."
    );

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": cfg.version,
  };
  if (cfg.authStyle === "bearer") headers.authorization = `Bearer ${apiKey}`;
  else headers["x-api-key"] = apiKey;

  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers,
      // Không có timeout thì request treo vô hạn khi endpoint không phản hồi,
      // và người dùng chỉ thấy spinner quay mãi không có lỗi nào
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: args.maxTokens ?? cfg.maxTokens,
        system: args.system,
        messages: [{ role: "user", content: args.content }],
        // Nói tường minh là không muốn stream. Thiếu trường này, một số gateway
        // mặc định bật stream và trả về SSE — lúc đó res.json() sẽ nổ. Ta vẫn
        // đọc được SSE ở dưới, nhưng xin đúng thứ mình cần vẫn tốt hơn.
        stream: false,
      }),
    });
  } catch (e) {
    // Sai endpoint hoặc mạng chặn — nói rõ nguyên nhân thật, không chỉ "fetch failed"
    throw new HttpError(502, describeFetchFailure(e, cfg.host, FETCH_TIMEOUT_MS));
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Kèm host và model vì lỗi hay gặp nhất là gateway không nhận tên model.
    // Bắt buộc redact: body lỗi của gateway có thể chứa lại chính API key.
    throw new HttpError(
      502,
      `${cfg.host} trả lỗi ${res.status} với model "${cfg.model}". ${redactSecrets(
        detail.slice(0, 300)
      )}`
    );
  }

  // Đọc thành text trước rồi mới quyết định cách bóc, chứ không gọi res.json()
  // ngay: body chỉ đọc được một lần, nên nếu json() nổ thì ta mất luôn nội dung
  // và chỉ còn lại "Unexpected token" không nói được gì.
  const bodyText = await res.text();
  const contentType = res.headers.get("content-type") ?? "";

  // Log lại để debug khi model trả về cấu trúc lạ
  console.log(`[AI Response] model: ${cfg.model}, status: ${res.status}, content-type: ${contentType}`);
  // Dùng slice để không làm ngập console, và redact để tránh lộ key nếu gateway vọng lại
  console.log(redactSecrets(bodyText.slice(0, 2000)));

  const looksSse =
    contentType.includes("event-stream") || /^\s*(event|data):/.test(bodyText);

  if (looksSse) {
    const { text, error } = parseSseText(bodyText);
    if (error) throw new HttpError(502, redactSecrets(error));
    if (!text)
      throw new HttpError(
        502,
        `${cfg.host} trả về dạng stream nhưng không có nội dung nào đọc được. Nếu gateway của bạn chỉ hỗ trợ stream, hãy kiểm tra lại model "${cfg.model}".`
      );
    return text;
  }

  let data: {
    // Claude
    content?: { type: string; text?: string }[];
    // Gemini
    candidates?: {
      content: {
        parts: { text: string }[];
      };
    }[];
    // OpenAI-compatible
    choices?: {
      message: {
        content: string | null;
      };
    }[];
  };
  try {
    data = JSON.parse(bodyText) as typeof data;
  } catch {
    // Không phải JSON mà cũng không phải SSE: thường là trang HTML của proxy
    // chen vào (trang đăng nhập, thông báo chặn). Kèm một mẩu body để nhận ra.
    throw new HttpError(
      502,
      `${cfg.host} trả về nội dung không phải JSON (content-type: ${
        contentType || "không có"
      }). Có thể có proxy chen giữa và trả về trang riêng của nó. Đoạn đầu phản hồi: ${redactSecrets(
        bodyText.slice(0, 200).replace(/\s+/g, " ").trim()
      )}`
    );
  }

  let text = "";
  // Anthropic Claude format
  if (Array.isArray(data.content)) {
    text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
  }
  // Google Gemini format
  else if (Array.isArray(data.candidates) && data.candidates[0]?.content?.parts) {
    text = data.candidates[0].content.parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  }
  // OpenAI-compatible format (from gateways like LiteLLM)
  else if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
    text = data.choices[0].message.content.trim();
  }

  if (!text) {
    const detail = `Model "${cfg.model}" không trả về nội dung nào. Cấu trúc nhận được: ${redactSecrets(
      JSON.stringify(data).slice(0, 500)
    )}`;
    // Log lại ở đây vì fail() trong route handler không log HttpError
    console.error(`[AI Error] ${detail}`);
    throw new HttpError(502, detail);
  }

  return text;
}
