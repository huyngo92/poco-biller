import { HttpError, requireUser } from "@/lib/auth";
import { assertMember, listMembers } from "@/lib/queries";
import { askClaude, extractJson } from "@/lib/claude";
import { fail, ok } from "@/lib/api";
import { CATEGORIES, type OcrResult } from "@/lib/types";
import { today } from "@/lib/period";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM = `Bạn đọc ảnh hoá đơn Việt Nam và trích xuất dữ liệu.

Trả về DUY NHẤT một khối JSON, không giải thích gì thêm:
{
  "title": "tên quán hoặc mô tả ngắn",
  "total": <tổng tiền cuối cùng phải trả, số nguyên VND>,
  "category": "<một trong: ${CATEGORIES.map((c) => c.id).join(", ")}>",
  "spentOn": "yyyy-mm-dd hoặc null nếu hoá đơn không ghi ngày",
  "items": [{ "name": "tên món", "quantity": <số>, "price": <giá tổng của dòng đó, số nguyên VND> }],
  "note": "ghi chú ngắn nếu có, ví dụ đã gồm VAT hoặc phí phục vụ"
}

Quy tắc:
- total là số tiền THỰC PHẢI TRẢ sau thuế, phí phục vụ và giảm giá.
- Số tiền là số nguyên VND, bỏ mọi dấu phân cách. "125.000" là 125000.
- Nếu ảnh mờ hoặc không phải hoá đơn, trả total 0 và items rỗng.`;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const groupId = Number(form.get("groupId"));
    assertMember(groupId, user.id);

    const file = form.get("image");
    if (!(file instanceof File)) throw new HttpError(400, "Chưa chọn ảnh hoá đơn.");
    if (file.size > MAX_BYTES)
      throw new HttpError(400, "Ảnh lớn hơn 5 MB. Bạn chụp lại nhỏ hơn giúp.");
    if (!ALLOWED.includes(file.type))
      throw new HttpError(400, "Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.");

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const text = await askClaude({
      system: SYSTEM,
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: file.type, data: base64 },
        },
        { type: "text", text: "Đọc hoá đơn này và trả JSON theo đúng định dạng." },
      ],
    });

    const parsed = extractJson<Partial<OcrResult> & { spentOn?: string | null }>(text);

    const members = listMembers(groupId);
    const result: OcrResult = {
      title: (parsed.title || "Hoá đơn").slice(0, 200),
      total: Math.max(0, Math.round(Number(parsed.total) || 0)),
      category: CATEGORIES.some((c) => c.id === parsed.category)
        ? (parsed.category as string)
        : "an-uong",
      spentOn:
        typeof parsed.spentOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.spentOn)
          ? parsed.spentOn
          : today(),
      items: Array.isArray(parsed.items)
        ? parsed.items.slice(0, 60).map((it) => ({
            name: String(it?.name ?? "").slice(0, 120),
            quantity: Math.max(1, Math.round(Number(it?.quantity) || 1)),
            price: Math.max(0, Math.round(Number(it?.price) || 0)),
          }))
        : [],
      note: String(parsed.note ?? "").slice(0, 500),
    };

    return ok({ result, memberCount: members.length });
  } catch (e) {
    return fail(e);
  }
}
