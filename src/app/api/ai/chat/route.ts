import { HttpError, requireUser } from "@/lib/auth";
import { assertMember, listMembers, resolveShares } from "@/lib/queries";
import { askClaude, extractJson } from "@/lib/claude";
import { fail, num, ok, str } from "@/lib/api";
import { CATEGORIES, type ChatDraft, type SplitMode } from "@/lib/types";
import { today } from "@/lib/period";

function buildSystem(
  members: { userId: number; name: string }[],
  currentUserId: number,
  todayIso: string
): string {
  const roster = members
    .map((m) => `- id ${m.userId}: ${m.name}${m.userId === currentUserId ? " (người đang nhập, tức là \"tôi\", \"mình\", \"tớ\")" : ""}`)
    .join("\n");

  return `Bạn giúp một nhóm người Việt ghi lại bill và chia tiền. Hôm nay là ${todayIso}.

Thành viên trong nhóm:
${roster}

Người dùng mô tả khoản chi bằng tiếng Việt tự nhiên. Hãy trả về DUY NHẤT một khối JSON:
{
  "title": "tên khoản chi ngắn gọn",
  "category": "<một trong: ${CATEGORIES.map((c) => c.id).join(", ")}>",
  "total": <tổng tiền, số nguyên VND>,
  "paidBy": <id người ứng tiền>,
  "spentOn": "yyyy-mm-dd",
  "splitMode": "equal" | "shares" | "exact",
  "note": "ghi chú nếu cần",
  "shares": [{ "userId": <id>, "weight": <số phần>, "amount": <số tiền nếu splitMode là exact> }],
  "explanation": "một câu tiếng Việt giải thích cách bạn chia"
}

Quy tắc:
- Hiểu cách viết tiền tắt: "150k" = 150000, "1tr2" hoặc "1.2tr" = 1200000, "250 nghìn" = 250000.
- Hiểu ngày tương đối: "hôm nay", "hôm qua", "tối qua", "thứ 6 tuần trước" — quy về yyyy-mm-dd.
- Chia đều thì dùng splitMode "equal" và weight 1 cho mỗi người.
- "A gấp đôi B", "A ăn 2 phần" thì dùng "shares" với weight tương ứng.
- Số tiền cụ thể cho từng người thì dùng "exact" và điền amount, tổng amount phải bằng total.
- Nếu không nói ai ứng tiền thì mặc định là người đang nhập.
- Nếu không nói chia cho ai thì chia đều cho toàn bộ thành viên.
- Chỉ dùng userId có trong danh sách trên. Không bịa thêm người.
- Nếu câu mô tả không đủ để biết tổng tiền, đặt total 0 và nói rõ trong explanation là cần bổ sung số tiền.`;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const groupId = num(body.groupId, "groupId");
    assertMember(groupId, user.id);

    const message = str(body.message, "nội dung", 2000);
    const members = listMembers(groupId);
    const memberIds = new Set(members.map((m) => m.userId));
    const todayIso = today();

    const text = await askClaude({
      system: buildSystem(members, user.id, todayIso),
      content: [{ type: "text", text: message }],
    });

    const raw = extractJson<Record<string, unknown>>(text);

    const total = Math.max(0, Math.round(Number(raw.total) || 0));
    const paidBy = memberIds.has(Number(raw.paidBy)) ? Number(raw.paidBy) : user.id;
    const splitMode: SplitMode =
      raw.splitMode === "shares" || raw.splitMode === "exact" || raw.splitMode === "percent"
        ? (raw.splitMode as SplitMode)
        : "equal";

    const rawShares = Array.isArray(raw.shares) ? raw.shares : [];
    let cleaned = rawShares
      .map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return {
          userId: Number(o.userId),
          weight: Math.max(0, Number(o.weight) || 1),
          amount: Math.max(0, Math.round(Number(o.amount) || 0)),
        };
      })
      .filter((s) => memberIds.has(s.userId));

    // AI không xác định được người chia thì chia đều cả nhóm
    if (cleaned.length === 0)
      cleaned = members.map((m) => ({ userId: m.userId, weight: 1, amount: 0 }));

    const nameOf = new Map(members.map((m) => [m.userId, m.name]));

    // Tính lại số tiền ở phía server để tổng luôn khớp
    let amounts: { userId: number; amount: number }[];
    if (total > 0) {
      try {
        amounts = resolveShares({
          groupId,
          title: "x",
          category: "khac",
          total,
          paidBy,
          spentOn: todayIso,
          splitMode,
          shares: cleaned,
        });
      } catch {
        // Ví dụ exact nhưng tổng lệch — quay về chia đều cho chắc
        amounts = resolveShares({
          groupId,
          title: "x",
          category: "khac",
          total,
          paidBy,
          spentOn: todayIso,
          splitMode: "equal",
          shares: cleaned.map((s) => ({ userId: s.userId, weight: 1 })),
        });
      }
    } else {
      amounts = cleaned.map((s) => ({ userId: s.userId, amount: 0 }));
    }

    const draft: ChatDraft = {
      title: String(raw.title ?? "Khoản chi").slice(0, 200),
      category: CATEGORIES.some((c) => c.id === raw.category)
        ? String(raw.category)
        : "khac",
      total,
      paidBy,
      spentOn:
        typeof raw.spentOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.spentOn)
          ? raw.spentOn
          : todayIso,
      splitMode,
      note: String(raw.note ?? "").slice(0, 500),
      shares: cleaned.map((s, i) => ({
        userId: s.userId,
        name: nameOf.get(s.userId) ?? "?",
        weight: s.weight,
        amount: amounts[i]?.amount ?? 0,
      })),
      explanation: String(raw.explanation ?? "").slice(0, 500),
    };

    if (total === 0)
      throw new HttpError(
        422,
        "Mình chưa thấy số tiền trong câu mô tả. Bạn thêm số tiền rồi gửi lại giúp, ví dụ \"ăn trưa 450k chia đều 3 người\"."
      );

    return ok({ draft });
  } catch (e) {
    return fail(e);
  }
}
