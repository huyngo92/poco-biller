import { HttpError } from "./auth";

export type TextBlock = { type: "text"; text: string };
export type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
export type ContentBlock = TextBlock | ImageBlock;

/**
 * Host này là địa chỉ công khai trên Internet, hay là tên máy trong mạng nội bộ?
 *
 * Dùng để chọn lời khuyên khi gặp lỗi chứng chỉ: cùng một mã lỗi nhưng nguyên
 * nhân trái ngược nhau. Tên nội bộ dùng chứng chỉ tự ký là chuyện bình thường;
 * còn host công khai đáng ra luôn có chứng chỉ hợp lệ, nên nếu nó báo tự ký thì
 * có thứ gì đó đang chen vào giữa.
 *
 * Nhận diện theo hình dạng tên, không tra cứu mạng: phải chạy được cả khi máy
 * không ra được Internet, mà đó chính là lúc hay gặp lỗi này nhất.
 */
export function isPublicHost(host: string): boolean {
  const h = host.replace(/:\d+$/, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  // Đuôi dành riêng cho mạng nội bộ theo quy ước hoặc theo RFC 6762/8375
  if (/\.(local|internal|intranet|lan|corp|home|test|invalid|example)$/.test(h))
    return false;
  // IPv4: chỉ dải private/loopback/link-local/CGNAT là nội bộ
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fd") || h.startsWith("fc"))
    return false;
  // Không có dấu chấm nào thì là tên máy đơn trong mạng LAN, không phải FQDN
  return h.includes(".");
}

/**
 * Giải thích lỗi chứng chỉ HTTPS kèm cách chữa đúng cho từng tình huống.
 *
 * Tách riêng vì đây là nhóm lỗi dễ chẩn đoán sai nhất. Đã kiểm chứng bằng HTTPS
 * server dựng tại chỗ: leaf tự ký cho `DEPTH_ZERO_SELF_SIGNED_CERT`, còn CA tự
 * ký nằm trong chuỗi cho `SELF_SIGNED_CERT_IN_CHAIN`. Mã thứ hai xuất hiện với
 * một host công khai gần như luôn nghĩa là thiết bị kiểm soát mạng đang cắt và
 * giải mã TLS rồi phát lại bằng CA riêng của tổ chức — không phải lỗi cấu hình
 * app, và cũng không sửa được bằng cách đổi base URL.
 */
export function describeCertFailure(code: string, host: string): string {
  if (code === "CERT_HAS_EXPIRED")
    return `Chứng chỉ HTTPS của ${host} đã hết hạn. Nếu đây là dịch vụ của bạn thì cần gia hạn chứng chỉ; nếu không thì kiểm tra đồng hồ hệ thống của máy chạy app, lệch ngày cũng làm chứng chỉ còn hạn bị coi là hết hạn.`;

  if (code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return `Chứng chỉ của ${host} được cấp cho một tên miền khác. Kiểm tra lại tên miền trong cấu hình endpoint — thường là do gọi vào IP hoặc vào tên nội bộ thay vì tên chính thức ghi trên chứng chỉ.`;

  const inChain =
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

  if (inChain && isPublicHost(host))
    return `Kết nối tới ${host} bị chen ngang: chuỗi chứng chỉ có một CA tự ký (${code}). ${host} là địa chỉ công khai, đáng ra luôn có chứng chỉ hợp lệ, nên gần như chắc chắn thiết bị kiểm soát mạng (proxy công ty, phần mềm diệt virus quét HTTPS) đang giải mã rồi phát lại bằng CA riêng. Không phải lỗi cấu hình endpoint. Cách chữa: xin file CA nội bộ từ bộ phận IT rồi khởi động app kèm NODE_EXTRA_CA_CERTS=/duong/dan/ca.pem — lưu ý phải đặt ở dòng lệnh, ghi vào .env không có tác dụng. Nếu chính sách không cho, hãy nhờ IT đưa ${host} vào danh sách miễn quét.`;

  return `Chứng chỉ HTTPS của ${host} không hợp lệ (${code}). Nếu đây là gateway nội bộ dùng chứng chỉ tự ký, khởi động app kèm NODE_EXTRA_CA_CERTS=/duong/dan/ca.pem trỏ tới chứng chỉ đó — đặt trong .env sẽ không ăn, vì Node đọc biến này lúc khởi động tiến trình.`;
}

/**
 * Đoán nguyên nhân thật của một lỗi fetch.
 *
 * `fetch` của Node bọc mọi lỗi tầng dưới thành đúng một câu "fetch failed",
 * gần như không nói gì. Mã lỗi thật nằm ở `error.cause.code`. Không bóc ra thì
 * người dùng không phân biệt được sai tên miền, server tắt, hay hết thời gian
 * chờ — ba việc cần ba cách xử lý hoàn toàn khác nhau.
 */
export function describeFetchFailure(e: unknown, host: string, timeoutMs: number): string {
  const cause = (e as { cause?: unknown })?.cause;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code: unknown }).code)
      : "";
  const name = e instanceof Error ? e.name : "";

  // Người gọi đã abort do quá hạn — không phải lỗi cấu hình
  if (name === "TimeoutError" || name === "AbortError" || code === "ABORT_ERR")
    return `${host} không trả lời trong ${Math.round(
      timeoutMs / 1000
    )} giây. Nếu đây là dịch vụ chạy trên gói miễn phí (Render, Fly, Railway), nó ngủ khi không ai dùng và cần khoảng một phút để thức lại — bạn thử lại lần nữa xem sao.`;

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `Không tra được tên miền ${host}. Kiểm tra lại chính tả trong cấu hình endpoint, và xem máy chạy app có ra được Internet không.`;
    case "ECONNREFUSED":
      return `${host} từ chối kết nối. Tên miền đúng nhưng không có gì đang lắng nghe ở đó — dịch vụ có thể đã tắt hoặc sai cổng.`;
    case "ECONNRESET":
      return `${host} ngắt kết nối giữa lúc đang gọi. Thường là dịch vụ vừa khởi động lại hoặc bị proxy chặn; thử lại sau một lát.`;
    case "ETIMEDOUT":
      return `Hết thời gian chờ khi kết nối tới ${host}. Có thể tường lửa đang chặn, hoặc dịch vụ đang ngủ và chưa thức kịp.`;
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "CERT_UNTRUSTED":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return describeCertFailure(code, host);
    default:
      break;
  }

  // Nhánh mặc định ghép nguyên văn message của lỗi tầng dưới — redact cho chắc,
  // vì một số lỗi TLS/proxy đính kèm cả URL có credential trong đó.
  const detail = redactSecrets(e instanceof Error ? e.message : String(e));
  return `Không kết nối được tới ${host}. Kiểm tra lại cấu hình endpoint và đường mạng. (${detail}${
    code ? `, mã ${code}` : ""
  })`;
}

/** Các biến môi trường chứa API key của mọi provider AI đã hỗ trợ — dùng để che khi in lỗi. */
const SECRET_ENV_VARS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"];

/**
 * Xoá dấu vết bí mật khỏi chuỗi trước khi cho nó ra khỏi server.
 *
 * Cần thiết vì ta ghép nguyên văn body lỗi của gateway vào thông báo, mà một số
 * gateway vọng lại toàn bộ request header khi trả 401 — làm vậy là đẩy chính
 * API key ra trình duyệt và vào log phía client. Đã kiểm chứng bằng gateway giả.
 *
 * Che theo hai lớp: giá trị key thật của CẢ BA provider (chắc chắn nhất, phòng
 * khi lỗi của provider này lẫn key của provider khác do dùng chung hàm), và các
 * dạng token phổ biến (phòng khi gateway chèn credential của riêng nó).
 */
export function redactSecrets(text: string): string {
  let out = text;

  for (const name of SECRET_ENV_VARS) {
    const key = process.env[name];
    // Key ngắn bất thường thì bỏ qua: replaceAll một chuỗi 2-3 ký tự sẽ băm nát
    // cả câu, và key thật không bao giờ ngắn thế
    if (key && key.length >= 8) out = out.split(key).join("…(key đã che)");
  }

  return out
    // Bearer <token>
    .replace(/\bBearer\s+[\w.\-~+/]{8,}=*/gi, "Bearer …(đã che)")
    // sk-ant-…, sk-…, và các tiền tố tương tự
    .replace(/\bsk-[\w-]{8,}/gi, "sk-…(đã che)")
    // "x-api-key": "…" trong JSON vọng lại
    .replace(
      /("(?:x-api-key|authorization|api[_-]?key|x-goog-api-key)"\s*:\s*")[^"]{8,}"/gi,
      '$1…(đã che)"'
    );
}

/**
 * Gộp text từ một phản hồi dạng SSE của Messages API.
 *
 * Vì sao cần: có gateway trả `text/event-stream` dù ta xin `stream: false`, và
 * `res.json()` gặp "event: message_start" là nổ ngay. Thay vì bắt người dùng đi
 * đổi gateway, ta đọc luôn cả hai định dạng.
 *
 * Chỉ lấy `text_delta` trong `content_block_delta`. Không dùng `message_stop`
 * hay `content_block_stop` vì chúng không chứa nội dung. Riêng event `error`
 * phải bóc ra: khi model vượt hạn mức, gateway trả HTTP 200 rồi mới báo lỗi
 * giữa dòng stream, nên nếu bỏ qua thì ta chỉ thấy "không trả về nội dung nào"
 * mà mất hẳn lý do thật.
 */
export function parseSseText(raw: string): { text: string; error?: string } {
  const chunks: string[] = [];
  let error: string | undefined;

  // Tách theo dòng, chấp nhận cả CRLF. Một "data:" có thể xuất hiện nhiều lần
  // trong cùng một event; ta xử lý từng dòng độc lập nên không cần ghép event.
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    // "[DONE]" là quy ước của OpenAI, không phải Anthropic, nhưng gateway trung
    // gian hay chèn vào — bỏ qua chứ đừng cố parse
    if (!payload || payload === "[DONE]") continue;

    let ev: unknown;
    try {
      ev = JSON.parse(payload);
    } catch {
      // Dòng data lỗi cú pháp thì bỏ, đừng làm hỏng cả phản hồi vì một dòng
      continue;
    }
    if (typeof ev !== "object" || ev === null) continue;
    const o = ev as {
      type?: string;
      delta?: { type?: string; text?: string };
      content_block?: { type?: string; text?: string };
      error?: { message?: string };
    };

    if (o.type === "content_block_delta" && o.delta?.type === "text_delta")
      chunks.push(o.delta.text ?? "");
    // Khối text ngắn có thể nằm gọn trong content_block_start, không có delta nào
    else if (o.type === "content_block_start" && o.content_block?.type === "text")
      chunks.push(o.content_block.text ?? "");
    else if (o.type === "error" && !error)
      error = o.error?.message || "Gateway báo lỗi giữa lúc đang stream.";
  }

  return { text: chunks.join("").trim(), error };
}

/** Model hay bọc JSON trong ```json ... ``` — bóc ra rồi parse. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        // rơi xuống lỗi bên dưới
      }
    }
    throw new HttpError(502, "AI trả về dữ liệu không đọc được. Bạn thử lại giúp.");
  }
}
