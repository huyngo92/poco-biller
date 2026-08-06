import { requireUser } from "@/lib/auth";
import { aiConfig, askClaude } from "@/lib/claude";
import { fail, ok } from "@/lib/api";

/**
 * Cho biết app đang gọi endpoint/model nào, để admin không phải SSH vào máy đọc
 * file .env mỗi lần muốn kiểm tra.
 *
 * Chỉ trả host và tên model. KHÔNG trả API key, cũng không trả đường dẫn đầy đủ
 * (path của gateway nội bộ có thể là thông tin không nên phát tán).
 */
export async function GET() {
  try {
    await requireUser();
    const cfg = aiConfig();
    return ok({
      host: cfg.host,
      model: cfg.model,
      maxTokens: cfg.maxTokens,
      authStyle: cfg.authStyle,
      timeoutMs: cfg.timeoutMs,
      hasKey: cfg.hasKey,
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Gọi thử một lượt để xem endpoint có sống không.
 *
 * Trả 200 kèm `{ ok: false, message }` thay vì trả mã lỗi HTTP: đây là kết quả
 * của một phép thử, không phải lỗi của chính request này. Nếu trả 502 thì lớp
 * apiJson ở client sẽ ném exception và ta mất mất thông tin chẩn đoán.
 */
export async function POST() {
  try {
    await requireUser();
    const started = Date.now();
    try {
      // Prompt ngắn nhất có thể — chỉ cần biết đường đi có thông, không cần
      // model trả lời hay. maxTokens nhỏ để không tốn tiền khi bấm nhiều lần.
      const text = await askClaude({
        system: "Trả lời đúng một từ: OK",
        content: [{ type: "text", text: "ping" }],
        maxTokens: 16,
      });
      return ok({
        ok: true,
        ms: Date.now() - started,
        sample: text.slice(0, 60),
      });
    } catch (e) {
      return ok({
        ok: false,
        ms: Date.now() - started,
        message:
          e instanceof Error ? e.message : "Lỗi không xác định khi gọi thử.",
      });
    }
  } catch (e) {
    // Lỗi ở đây là chưa đăng nhập hoặc env sai — đúng là lỗi của request
    return fail(e);
  }
}
