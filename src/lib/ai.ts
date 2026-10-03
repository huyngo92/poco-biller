import { HttpError } from "./auth";
import { aiConfig, askClaude } from "./claude";
import { geminiConfig, askGemini } from "./gemini";
import { openAiConfig, askOpenAi } from "./openai";

export { type ContentBlock, extractJson } from "./ai-shared";
import type { ContentBlock } from "./ai-shared";

export type AiProvider = "anthropic" | "openai" | "gemini";

/**
 * Provider chính dùng cho OCR hoá đơn và nhập bill bằng chat, chọn qua
 * AI_PROVIDER trong .env. Bỏ trống = "anthropic" (mặc định từ trước tới nay).
 */
export function activeAiProvider(): AiProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return "anthropic";
  if (raw === "anthropic" || raw === "openai" || raw === "gemini") return raw;
  throw new HttpError(
    500,
    `AI_PROVIDER chỉ nhận "anthropic", "openai" hoặc "gemini", đang là "${raw}".`
  );
}

/** Gọi AI theo provider đang active, cùng tham số cho cả ba provider. */
export async function askAi(args: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  switch (activeAiProvider()) {
    case "openai":
      return askOpenAi(args);
    case "gemini":
      return askGemini(args);
    case "anthropic":
    default:
      return askClaude(args);
  }
}

export type CurrentAiConfig = {
  provider: AiProvider;
  host: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  hasKey: boolean;
};

/** Cấu hình của provider đang active — dùng cho /api/ai/config. */
export function currentAiConfig(): CurrentAiConfig {
  const provider = activeAiProvider();
  if (provider === "openai") {
    const cfg = openAiConfig();
    return { provider, host: cfg.host, model: cfg.model, maxTokens: cfg.maxTokens, timeoutMs: cfg.timeoutMs, hasKey: cfg.hasKey };
  }
  if (provider === "gemini") {
    const cfg = geminiConfig();
    return { provider, host: cfg.host, model: cfg.model, maxTokens: cfg.maxTokens, timeoutMs: cfg.timeoutMs, hasKey: cfg.hasKey };
  }
  const cfg = aiConfig();
  return { provider, host: cfg.host, model: cfg.model, maxTokens: cfg.maxTokens, timeoutMs: cfg.timeoutMs, hasKey: cfg.hasKey };
}
