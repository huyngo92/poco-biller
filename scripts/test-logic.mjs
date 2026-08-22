/**
 * Kiểm tra logic tiền tệ và cân bằng nợ mà không cần chạy server.
 * Chạy: node scripts/test-logic.mjs
 *
 * Các hàm dưới đây là bản sao 1:1 của src/lib/money.ts và src/lib/balance.ts.
 * Nếu sửa logic gốc, nhớ đồng bộ file này.
 */

import assert from "node:assert/strict";

/* ---------- bản sao logic cần kiểm tra ---------- */

function parseVnd(input) {
  const raw = input.trim().toLowerCase().replace(/₫|vnd|đồng|đ/g, "").trim();
  if (!raw) return null;
  const m = raw.match(/^([\d.,\s]+)\s*(ty|tỷ|tr|trieu|triệu|m|k|nghin|nghìn|ngan|ngàn)?$/);
  if (!m) return null;
  const numPart = m[1].replace(/\s/g, "");
  const unit = m[2];
  let value;
  if (unit) {
    const normalized = numPart.replace(/[.,]/g, ".");
    if ((normalized.match(/\./g) || []).length > 1) return null;
    value = Number(normalized);
  } else {
    value = Number(numPart.replace(/[.,]/g, ""));
  }
  if (!Number.isFinite(value)) return null;
  const factor =
    unit === "ty" || unit === "tỷ"
      ? 1_000_000_000
      : unit === "tr" || unit === "trieu" || unit === "triệu" || unit === "m"
        ? 1_000_000
        : unit
          ? 1_000
          : 1;
  return Math.round(value * factor);
}

function splitByWeights(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v), w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  const result = [...floors];
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    result[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}

function computeBalances(members, bills, settlements) {
  const paid = new Map();
  const owed = new Map();
  for (const m of members) {
    paid.set(m.userId, 0);
    owed.set(m.userId, 0);
  }
  const bump = (map, id, delta) => map.set(id, (map.get(id) ?? 0) + delta);
  for (const b of bills) {
    bump(paid, b.paidBy, b.total);
    for (const s of b.shares) bump(owed, s.userId, s.amount);
  }
  for (const s of settlements) {
    bump(paid, s.fromUserId, s.amount);
    bump(paid, s.toUserId, -s.amount);
  }
  return members.map((m) => {
    const p = paid.get(m.userId) ?? 0;
    const o = owed.get(m.userId) ?? 0;
    return { userId: m.userId, name: m.name, paid: p, owed: o, net: p - o };
  });
}

function suggestTransfers(balances, minAmount = 1000) {
  const debtors = balances
    .filter((b) => b.net < -0.5)
    .map((b) => ({ ...b, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((b) => b.net > 0.5)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);
  const out = [];
  let i = 0;
  let j = 0;
  let guard = 0;
  while (i < debtors.length && j < creditors.length && guard++ < 1000) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.round(Math.min(d.remaining, c.remaining));
    if (amount >= minAmount)
      out.push({
        fromUserId: d.userId,
        fromName: d.name,
        toUserId: c.userId,
        toName: c.name,
        amount,
      });
    d.remaining -= amount;
    c.remaining -= amount;
    if (d.remaining < minAmount) i += 1;
    if (c.remaining < minAmount) j += 1;
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/* ---------- bản sao src/lib/chart.ts ---------- */

function pctChange(current, previous) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Chỉ tính phần trăm — phần vẽ path do Visx xử lý. */
function donutPercents(data) {
  const total = data.reduce((a, b) => a + b.amount, 0);
  if (total <= 0) return [];
  return data.map((d) => ({
    category: d.category,
    percent: Math.round((d.amount / total) * 100),
  }));
}

/* ---------- bản sao resolveMessagesUrl trong src/lib/claude.ts ---------- */

const DEFAULT_BASE_URL = "https://api.anthropic.com";

function resolveMessagesUrl(base) {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return `${DEFAULT_BASE_URL}/v1/messages`;
  if (/\/messages$/.test(trimmed)) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

/* ---------- bản sao redactSecrets trong src/lib/claude.ts ---------- */

function redactSecrets(text) {
  let out = text;
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.length >= 8) out = out.split(key).join("…(key đã che)");
  return out
    .replace(/\bBearer\s+[\w.\-~+/]{8,}=*/gi, "Bearer …(đã che)")
    .replace(/\bsk-[\w-]{8,}/gi, "sk-…(đã che)")
    .replace(
      /("(?:x-api-key|authorization|api[_-]?key)"\s*:\s*")[^"]{8,}"/gi,
      '$1…(đã che)"'
    );
}

/* ---------- bản sao extractJson trong src/lib/claude.ts ---------- */

// Bản rút gọn của HttpError trong lib/auth để thân hàm copy giữ nguyên 1:1
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // rơi xuống lỗi bên dưới
      }
    }
    throw new HttpError(502, "AI trả về dữ liệu không đọc được. Bạn thử lại giúp.");
  }
}

/* ---------- bản sao parseSseText trong src/lib/claude.ts ---------- */

function parseSseText(raw) {
  const chunks = [];
  let error;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let ev;
    try {
      ev = JSON.parse(payload);
    } catch {
      continue;
    }
    if (typeof ev !== "object" || ev === null) continue;
    const o = ev;

    if (o.type === "content_block_delta" && o.delta?.type === "text_delta")
      chunks.push(o.delta.text ?? "");
    else if (o.type === "content_block_start" && o.content_block?.type === "text")
      chunks.push(o.content_block.text ?? "");
    else if (o.type === "error" && !error)
      error = o.error?.message || "Gateway báo lỗi giữa lúc đang stream.";
  }

  return { text: chunks.join("").trim(), error };
}

/* ---------- bản sao isPublicHost + describeCertFailure trong claude.ts ---------- */

function isPublicHost(host) {
  const h = host.replace(/:\d+$/, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (/\.(local|internal|intranet|lan|corp|home|test|invalid|example)$/.test(h))
    return false;
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
  if (
    h === "::1" ||
    h.startsWith("fe80:") ||
    h.startsWith("fd") ||
    h.startsWith("fc")
  )
    return false;
  return h.includes(".");
}

function describeCertFailure(code, host) {
  if (code === "CERT_HAS_EXPIRED")
    return `Chứng chỉ HTTPS của ${host} đã hết hạn. Nếu đây là dịch vụ của bạn thì cần gia hạn chứng chỉ; nếu không thì kiểm tra đồng hồ hệ thống của máy chạy app, lệch ngày cũng làm chứng chỉ còn hạn bị coi là hết hạn.`;

  if (code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return `Chứng chỉ của ${host} được cấp cho một tên miền khác. Kiểm tra lại tên miền trong ANTHROPIC_BASE_URL — thường là do gọi vào IP hoặc vào tên nội bộ thay vì tên chính thức ghi trên chứng chỉ.`;

  const inChain =
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

  if (inChain && isPublicHost(host))
    return `Kết nối tới ${host} bị chen ngang: chuỗi chứng chỉ có một CA tự ký (${code}). ${host} là địa chỉ công khai, đáng ra luôn có chứng chỉ hợp lệ, nên gần như chắc chắn thiết bị kiểm soát mạng (proxy công ty, phần mềm diệt virus quét HTTPS) đang giải mã rồi phát lại bằng CA riêng. Không phải lỗi ANTHROPIC_BASE_URL. Cách chữa: xin file CA nội bộ từ bộ phận IT rồi khởi động app kèm NODE_EXTRA_CA_CERTS=/duong/dan/ca.pem — lưu ý phải đặt ở dòng lệnh, ghi vào .env không có tác dụng. Nếu chính sách không cho, hãy nhờ IT đưa ${host} vào danh sách miễn quét.`;

  return `Chứng chỉ HTTPS của ${host} không hợp lệ (${code}). Nếu đây là gateway nội bộ dùng chứng chỉ tự ký, khởi động app kèm NODE_EXTRA_CA_CERTS=/duong/dan/ca.pem trỏ tới chứng chỉ đó — đặt trong .env sẽ không ăn, vì Node đọc biến này lúc khởi động tiến trình.`;
}

/* ---------- bản sao describeFetchFailure trong src/lib/claude.ts ---------- */

const FETCH_TIMEOUT_MS = 90_000;

function describeFetchFailure(e, host) {
  const cause = e?.cause;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String(cause.code)
      : "";
  const name = e instanceof Error ? e.name : "";

  if (name === "TimeoutError" || name === "AbortError" || code === "ABORT_ERR")
    return `${host} không trả lời trong ${Math.round(
      FETCH_TIMEOUT_MS / 1000
    )} giây. Nếu đây là dịch vụ chạy trên gói miễn phí (Render, Fly, Railway), nó ngủ khi không ai dùng và cần khoảng một phút để thức lại — bạn thử lại lần nữa xem sao.`;

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `Không tra được tên miền ${host}. Kiểm tra lại chính tả trong ANTHROPIC_BASE_URL, và xem máy chạy app có ra được Internet không.`;
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

  const detail = redactSecrets(e instanceof Error ? e.message : String(e));
  return `Không kết nối được tới ${host}. Kiểm tra lại ANTHROPIC_BASE_URL và đường mạng. (${detail}${
    code ? `, mã ${code}` : ""
  })`;
}

/* --- bản sao src/lib/cron-expr.ts --- */

const CRON_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];
const CRON_FIELD_NAMES = ["phút", "giờ", "ngày trong tháng", "tháng", "thứ"];

function parseCronField(raw, index) {
  const [min, max] = CRON_RANGES[index];
  const out = new Set();

  for (const part of raw.split(",")) {
    const piece = part.trim();
    if (!piece) throw new Error(`Trường ${CRON_FIELD_NAMES[index]} có phần tử rỗng.`);

    const [spec, stepRaw] = piece.split("/");
    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1)
        throw new Error(`Bước nhảy "${stepRaw}" ở trường ${CRON_FIELD_NAMES[index]} không hợp lệ.`);
    }

    let from;
    let to;
    if (spec === "*") {
      from = min;
      to = max;
    } else if (spec.includes("-")) {
      const [a, b] = spec.split("-");
      from = Number(a);
      to = Number(b);
      if (!Number.isInteger(from) || !Number.isInteger(to))
        throw new Error(`Khoảng "${spec}" ở trường ${CRON_FIELD_NAMES[index]} không hợp lệ.`);
      if (from > to)
        throw new Error(`Khoảng "${spec}" ở trường ${CRON_FIELD_NAMES[index]} có đầu lớn hơn cuối.`);
    } else {
      from = Number(spec);
      to = from;
      if (!Number.isInteger(from))
        throw new Error(`Giá trị "${spec}" ở trường ${CRON_FIELD_NAMES[index]} không phải số nguyên.`);
    }

    if (from < min || to > max)
      throw new Error(
        `Giá trị "${spec}" ở trường ${CRON_FIELD_NAMES[index]} ngoài khoảng cho phép ${min}-${max}.`
      );

    for (let v = from; v <= to; v += step) out.add(v);
  }

  return out;
}

function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5)
    throw new Error(
      `Lịch cron phải có đúng 5 trường (phút giờ ngày tháng thứ), nhận được ${parts.length}: "${expr.trim()}".`
    );

  return {
    minute: parseCronField(parts[0], 0),
    hour: parseCronField(parts[1], 1),
    dayOfMonth: parseCronField(parts[2], 2),
    month: parseCronField(parts[3], 3),
    dayOfWeek: parseCronField(parts[4], 4),
    domRestricted: parts[2].trim() !== "*",
    dowRestricted: parts[4].trim() !== "*",
    everyDay: parts[2].trim() === "*" && parts[4].trim() === "*",
  };
}

function cronMatches(fields, at) {
  if (!fields.minute.has(at.getMinutes())) return false;
  if (!fields.hour.has(at.getHours())) return false;
  if (!fields.month.has(at.getMonth() + 1)) return false;

  const domOk = fields.dayOfMonth.has(at.getDate());
  const dowOk = fields.dayOfWeek.has(at.getDay());

  if (fields.domRestricted && fields.dowRestricted) return domOk || dowOk;
  if (fields.domRestricted) return domOk;
  if (fields.dowRestricted) return dowOk;
  return true;
}

function describeCron(expr) {
  const f = parseCron(expr);
  const hours = [...f.hour].sort((a, b) => a - b);
  const minutes = [...f.minute].sort((a, b) => a - b);

  if (hours.length === 24 && minutes.length === 1)
    return `mỗi giờ vào phút thứ ${minutes[0]}`;
  if (hours.length === 1 && minutes.length === 1) {
    const at = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`;
    return f.everyDay ? `${at} mỗi ngày` : `${at} theo lịch "${expr.trim()}"`;
  }
  return `theo lịch "${expr.trim()}"`;
}

/* ---------- kiểm tra ---------- */

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("\nparseVnd — đọc số tiền người Việt gõ tay");
check("150k = 150000", () => assert.equal(parseVnd("150k"), 150_000));
check("1.2tr = 1200000", () => assert.equal(parseVnd("1.2tr"), 1_200_000));
check("1,5 triệu = 1500000", () => assert.equal(parseVnd("1,5 triệu"), 1_500_000));
check("250.000 = 250000", () => assert.equal(parseVnd("250.000"), 250_000));
check("1,250,000 = 1250000", () => assert.equal(parseVnd("1,250,000"), 1_250_000));
check("450000 đ = 450000", () => assert.equal(parseVnd("450000 đ"), 450_000));
check("2 tỷ = 2000000000", () => assert.equal(parseVnd("2 tỷ"), 2_000_000_000));
check("80 nghìn = 80000", () => assert.equal(parseVnd("80 nghìn"), 80_000));
check("chuỗi rác trả null", () => assert.equal(parseVnd("abc"), null));
check("chuỗi rỗng trả null", () => assert.equal(parseVnd("   "), null));

console.log("\nsplitByWeights — tổng các phần luôn khớp tổng bill");
check("100000 chia 3 người bằng nhau", () => {
  const r = splitByWeights(100_000, [1, 1, 1]);
  assert.equal(r.reduce((a, b) => a + b, 0), 100_000);
  assert.deepEqual(r.slice().sort(), [33333, 33333, 33334]);
});
check("10 đồng chia 3 người", () => {
  const r = splitByWeights(10, [1, 1, 1]);
  assert.equal(r.reduce((a, b) => a + b, 0), 10);
});
check("theo phần 2:1:1", () => {
  const r = splitByWeights(400_000, [2, 1, 1]);
  assert.deepEqual(r, [200_000, 100_000, 100_000]);
});
check("theo phần trăm 50:30:20", () => {
  const r = splitByWeights(999_999, [50, 30, 20]);
  assert.equal(r.reduce((a, b) => a + b, 0), 999_999);
});
check("một người chịu hết", () => {
  assert.deepEqual(splitByWeights(50_000, [1, 0, 0]), [50_000, 0, 0]);
});
check("trọng số toàn 0 thì không âm", () => {
  assert.deepEqual(splitByWeights(50_000, [0, 0]), [0, 0]);
});
check("100 lần chia ngẫu nhiên vẫn khớp tổng", () => {
  for (let i = 0; i < 100; i++) {
    const total = Math.floor(Math.random() * 9_000_000) + 1;
    const n = Math.floor(Math.random() * 7) + 1;
    const w = Array.from({ length: n }, () => Math.floor(Math.random() * 5) + 1);
    const r = splitByWeights(total, w);
    assert.equal(r.reduce((a, b) => a + b, 0), total, `lệch ở total=${total}`);
    assert.ok(r.every((x) => x >= 0), "có phần âm");
  }
});

console.log("\ncomputeBalances — ai ứng, ai nợ");
const members = [
  { userId: 1, name: "An" },
  { userId: 2, name: "Bình" },
  { userId: 3, name: "Chi" },
];

check("An ứng 300k chia đều 3 người", () => {
  const bills = [
    {
      paidBy: 1,
      total: 300_000,
      shares: [
        { userId: 1, amount: 100_000 },
        { userId: 2, amount: 100_000 },
        { userId: 3, amount: 100_000 },
      ],
    },
  ];
  const b = computeBalances(members, bills, []);
  assert.equal(b.find((x) => x.userId === 1).net, 200_000);
  assert.equal(b.find((x) => x.userId === 2).net, -100_000);
  assert.equal(b.find((x) => x.userId === 3).net, -100_000);
  assert.equal(b.reduce((a, x) => a + x.net, 0), 0, "tổng net phải bằng 0");
});

check("trả nợ rồi thì số dư về 0", () => {
  const bills = [
    {
      paidBy: 1,
      total: 200_000,
      shares: [
        { userId: 1, amount: 100_000 },
        { userId: 2, amount: 100_000 },
      ],
    },
  ];
  const settlements = [{ fromUserId: 2, toUserId: 1, amount: 100_000 }];
  const b = computeBalances(members, bills, settlements);
  assert.equal(b.find((x) => x.userId === 1).net, 0);
  assert.equal(b.find((x) => x.userId === 2).net, 0);
});

check("nhiều bill nhiều người ứng, tổng net vẫn bằng 0", () => {
  const bills = [
    {
      paidBy: 1,
      total: 450_000,
      shares: [
        { userId: 1, amount: 150_000 },
        { userId: 2, amount: 150_000 },
        { userId: 3, amount: 150_000 },
      ],
    },
    {
      paidBy: 2,
      total: 180_000,
      shares: [
        { userId: 2, amount: 90_000 },
        { userId: 3, amount: 90_000 },
      ],
    },
    {
      paidBy: 3,
      total: 1_000_000,
      shares: [
        { userId: 1, amount: 333_333 },
        { userId: 2, amount: 333_333 },
        { userId: 3, amount: 333_334 },
      ],
    },
  ];
  const b = computeBalances(members, bills, []);
  assert.equal(b.reduce((a, x) => a + x.net, 0), 0);
});

console.log("\nsuggestTransfers — gợi ý chuyển tiền");
check("2 người nợ 1 người thì có 2 giao dịch", () => {
  const b = [
    { userId: 1, name: "An", net: 200_000, paid: 0, owed: 0 },
    { userId: 2, name: "Bình", net: -100_000, paid: 0, owed: 0 },
    { userId: 3, name: "Chi", net: -100_000, paid: 0, owed: 0 },
  ];
  const t = suggestTransfers(b);
  assert.equal(t.length, 2);
  assert.equal(t.reduce((a, x) => a + x.amount, 0), 200_000);
  assert.ok(t.every((x) => x.toUserId === 1));
});

check("đã cân bằng thì không gợi ý gì", () => {
  const b = members.map((m) => ({ ...m, net: 0, paid: 0, owed: 0 }));
  assert.equal(suggestTransfers(b).length, 0);
});

check("chênh lệch vài đồng thì bỏ qua", () => {
  const b = [
    { userId: 1, name: "An", net: 2, paid: 0, owed: 0 },
    { userId: 2, name: "Bình", net: -2, paid: 0, owed: 0 },
  ];
  assert.equal(suggestTransfers(b).length, 0);
});

check("số giao dịch không vượt số người - 1", () => {
  for (let round = 0; round < 50; round++) {
    const n = Math.floor(Math.random() * 6) + 2;
    const nets = [];
    let sum = 0;
    for (let i = 0; i < n - 1; i++) {
      const v = Math.floor(Math.random() * 2_000_000) - 1_000_000;
      nets.push(v);
      sum += v;
    }
    nets.push(-sum);
    const b = nets.map((net, i) => ({
      userId: i + 1,
      name: `P${i + 1}`,
      net,
      paid: 0,
      owed: 0,
    }));
    const t = suggestTransfers(b);
    assert.ok(t.length <= n - 1, `${t.length} giao dịch cho ${n} người`);
  }
});

console.log("\noverdueLabel — nợ treo bao lâu");

function daysSince(isoDate, now) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y) return 0;
  const then = new Date(y, m - 1, d).getTime();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((start - then) / 86_400_000);
}

function overdueLabel(isoDate, now = new Date()) {
  const days = daysSince(isoDate, now);
  if (days >= 60) return `${Math.floor(days / 30)} tháng`;
  if (days >= 14) return `${Math.floor(days / 7)} tuần`;
  return null;
}

function isoDaysAgo(n, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

check("hôm nay thì không cảnh báo", () =>
  assert.equal(overdueLabel(isoDaysAgo(0)), null)
);
check("13 ngày vẫn chưa cảnh báo", () =>
  assert.equal(overdueLabel(isoDaysAgo(13)), null)
);
check("21 ngày = 3 tuần", () =>
  assert.equal(overdueLabel(isoDaysAgo(21)), "3 tuần")
);
check("95 ngày = 3 tháng", () =>
  assert.equal(overdueLabel(isoDaysAgo(95)), "3 tháng")
);
check("chuỗi rác không làm crash", () =>
  assert.equal(overdueLabel("khong-phai-ngay"), null)
);

console.log("\npctChange — so với kỳ trước");

check("tăng 20%", () => assert.equal(pctChange(120, 100), 20));
check("giảm 25%", () => assert.equal(pctChange(75, 100), -25));
check("bằng nhau = 0", () => assert.equal(pctChange(100, 100), 0));
check("kỳ trước bằng 0 thì không so được", () =>
  assert.equal(pctChange(100, 0), null)
);

console.log("\ndonutPercents — phân bổ hạng mục");

check("chia đều ba phần", () =>
  assert.deepEqual(
    donutPercents([
      { category: "an-uong", amount: 100 },
      { category: "ca-phe", amount: 100 },
      { category: "di-lai", amount: 100 },
    ]),
    [
      { category: "an-uong", percent: 33 },
      { category: "ca-phe", percent: 33 },
      { category: "di-lai", percent: 33 },
    ]
  )
);
check("tổng 0 thì không có lát nào", () =>
  assert.deepEqual(donutPercents([{ category: "khac", amount: 0 }]), [])
);
check("một hạng mục chiếm 100%", () =>
  assert.deepEqual(donutPercents([{ category: "an-uong", amount: 250_000 }]), [
    { category: "an-uong", percent: 100 },
  ])
);

console.log("\nresolveMessagesUrl — ghép endpoint AI từ env");

check("bỏ trống thì dùng api.anthropic.com", () =>
  assert.equal(resolveMessagesUrl(""), "https://api.anthropic.com/v1/messages")
);
check("chỉ có host thì thêm /v1/messages", () =>
  assert.equal(
    resolveMessagesUrl("https://api.anthropic.com"),
    "https://api.anthropic.com/v1/messages"
  )
);
check("có sẵn /v1 thì chỉ thêm /messages", () =>
  assert.equal(
    resolveMessagesUrl("https://gw.noi-bo/anthropic/v1"),
    "https://gw.noi-bo/anthropic/v1/messages"
  )
);
check("đã đủ /v1/messages thì giữ nguyên", () =>
  assert.equal(
    resolveMessagesUrl("https://gw.noi-bo/anthropic/v1/messages"),
    "https://gw.noi-bo/anthropic/v1/messages"
  )
);
check("dấu / ở cuối không sinh // ", () =>
  assert.equal(
    resolveMessagesUrl("https://api.anthropic.com///"),
    "https://api.anthropic.com/v1/messages"
  )
);
check("khoảng trắng hai đầu bị bỏ", () =>
  assert.equal(
    resolveMessagesUrl("  https://api.anthropic.com  "),
    "https://api.anthropic.com/v1/messages"
  )
);
check("gateway có path lồng vẫn ghép đúng", () =>
  assert.equal(
    resolveMessagesUrl("https://gw.noi-bo/ai/claude"),
    "https://gw.noi-bo/ai/claude/v1/messages"
  )
);
check("phiên bản khác v1 vẫn nhận", () =>
  assert.equal(
    resolveMessagesUrl("https://gw.noi-bo/anthropic/v2"),
    "https://gw.noi-bo/anthropic/v2/messages"
  )
);
check("localhost kèm cổng", () =>
  assert.equal(
    resolveMessagesUrl("http://localhost:4000"),
    "http://localhost:4000/v1/messages"
  )
);
check("chỉ khoảng trắng cũng về mặc định", () =>
  assert.equal(
    resolveMessagesUrl("   "),
    "https://api.anthropic.com/v1/messages"
  )
);
check("mọi kết quả đều là URL parse được", () => {
  for (const input of [
    "",
    "https://api.anthropic.com",
    "https://gw.noi-bo/anthropic/v1",
    "https://gw.noi-bo/anthropic/v1/messages",
    "http://localhost:4000/",
    "https://gw.noi-bo/ai/claude//",
  ]) {
    const u = new URL(resolveMessagesUrl(input));
    assert.ok(u.pathname.endsWith("/messages"), `thiếu /messages: ${input}`);
    assert.ok(!u.pathname.includes("//"), `path có //: ${input}`);
  }
});

console.log("\ndescribeFetchFailure — lỗi mạng phải chỉ đúng nguyên nhân");

/** Lỗi fetch của Node: luôn là "fetch failed", mã thật nằm trong cause.code */
function nodeFetchError(code) {
  const e = new TypeError("fetch failed");
  e.cause = Object.assign(new Error(code), { code });
  return e;
}

const H = "gw.example.com";

check("ENOTFOUND nói về tên miền, không nói 'fetch failed'", () => {
  const m = describeFetchFailure(nodeFetchError("ENOTFOUND"), H);
  assert.ok(m.includes("tên miền"), m);
  assert.ok(!m.includes("fetch failed"), "còn lộ thông báo thô của Node");
});
check("ECONNREFUSED nói server không lắng nghe", () =>
  assert.ok(
    describeFetchFailure(nodeFetchError("ECONNREFUSED"), H).includes("từ chối")
  )
);
check("ETIMEDOUT nói về thời gian chờ", () =>
  assert.ok(
    describeFetchFailure(nodeFetchError("ETIMEDOUT"), H).includes("thời gian chờ")
  )
);
check("EAI_AGAIN gộp cùng nhóm DNS", () =>
  assert.equal(
    describeFetchFailure(nodeFetchError("EAI_AGAIN"), H),
    describeFetchFailure(nodeFetchError("ENOTFOUND"), H)
  )
);
// Cert hết hạn không cần nhắc lại mã: câu đã tự giải thích. Nhưng phải gợi ý
// kiểm tra đồng hồ — lệch ngày cũng làm cert còn hạn bị coi là hết hạn, và đó
// là nguyên nhân người ta không nghĩ tới.
check("cert hết hạn gợi ý cả khả năng lệch đồng hồ", () => {
  const m = describeFetchFailure(nodeFetchError("CERT_HAS_EXPIRED"), H);
  assert.ok(m.includes("hết hạn"), m);
  assert.ok(m.includes("đồng hồ"), "không nhắc khả năng sai giờ hệ thống");
});
check("timeoutError gợi ý thử lại vì dịch vụ có thể đang ngủ", () => {
  const e = Object.assign(new Error("aborted"), { name: "TimeoutError" });
  const m = describeFetchFailure(e, H);
  assert.ok(m.includes("90 giây"), m);
  assert.ok(m.includes("thử lại"), "không gợi ý hành động tiếp theo");
});
check("mọi thông báo đều có tên host để biết đang gọi đâu", () => {
  const errs = [
    nodeFetchError("ENOTFOUND"),
    nodeFetchError("ECONNREFUSED"),
    nodeFetchError("ECONNRESET"),
    nodeFetchError("ETIMEDOUT"),
    nodeFetchError("CERT_HAS_EXPIRED"),
    Object.assign(new Error("x"), { name: "TimeoutError" }),
    new TypeError("fetch failed"),
    "chuỗi thay vì Error",
  ];
  for (const e of errs) {
    const m = describeFetchFailure(e, H);
    assert.ok(m.includes(H), `thiếu host: ${m}`);
  }
});
check("mã lạ vẫn giữ lại mã để tra cứu", () => {
  const m = describeFetchFailure(nodeFetchError("EPROTO"), H);
  assert.ok(m.includes("EPROTO"), m);
});
check("không phải Error cũng không làm crash", () =>
  assert.ok(describeFetchFailure("hỏng", H).includes("hỏng"))
);
check("cause thiếu code không làm crash", () => {
  const e = new TypeError("fetch failed");
  e.cause = new Error("không có code");
  assert.ok(describeFetchFailure(e, H).includes(H));
});

console.log("\nextractJson — bóc JSON từ câu trả lời của model");

check("JSON thuần parse thẳng", () =>
  assert.deepEqual(extractJson('{"total":150000}'), { total: 150000 })
);
// Model rất hay bọc trong ```json dù được yêu cầu trả JSON thuần
check("bóc được khối ```json", () =>
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
);
check("bóc được khối ``` không ghi ngôn ngữ", () =>
  assert.deepEqual(extractJson('```\n{"a":1}\n```'), { a: 1 })
);
// Model thêm câu dẫn trước/sau JSON — cắt theo ngoặc đầu và ngoặc cuối
check("bỏ được câu dẫn quanh JSON", () =>
  assert.deepEqual(extractJson('Đây nhé: {"a":1} nha bạn'), { a: 1 })
);
check("mảng ở mức ngoài cùng cũng đọc được", () =>
  assert.deepEqual(extractJson("[1,2,3]"), [1, 2, 3])
);
check("hỏng hoàn toàn thì ném HttpError 502 chứ không SyntaxError", () => {
  try {
    extractJson("mình không biết chia thế nào");
    assert.fail("đáng ra phải ném lỗi");
  } catch (e) {
    assert.equal(e.status, 502, "phải là HttpError có status");
    assert.ok(!(e instanceof SyntaxError), "không được để lọt SyntaxError thô");
  }
});

console.log("\nparseSseText — gateway trả stream thay vì JSON");

// Vì sao có nhóm này: gateway của user trả text/event-stream dù ta xin
// stream:false, và res.json() gặp "event: message_start" là nổ ngay. Đã tái
// hiện bằng gateway giả phát SSE với chunk cắt tuỳ tiện giữa dòng.
const sseDelta = (t) =>
  `event: content_block_delta\ndata: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text: t },
  })}\n\n`;

check("gộp các text_delta thành một chuỗi liền", () => {
  const raw =
    'event: message_start\ndata: {"type":"message_start"}\n\n' +
    sseDelta('{"total":') +
    sseDelta("1200000}") +
    'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  assert.deepEqual(parseSseText(raw), { text: '{"total":1200000}', error: undefined });
});
check("delta ghép lại phải parse được thành JSON", () => {
  const { text } = parseSseText(sseDelta('```json\n{"a":1,') + sseDelta('"b":2}\n```'));
  assert.deepEqual(extractJson(text), { a: 1, b: 2 });
});
check("CRLF vẫn tách dòng đúng", () => {
  const raw = (sseDelta("xin ") + sseDelta("chào")).replace(/\n/g, "\r\n");
  assert.equal(parseSseText(raw).text, "xin chào");
});
// "[DONE]" là quy ước của OpenAI, gateway trung gian hay chèn vào
check("[DONE] kiểu OpenAI bị bỏ qua, không làm hỏng parse", () => {
  assert.equal(parseSseText(sseDelta("xong") + "data: [DONE]\n\n").text, "xong");
});
check("text nằm gọn trong content_block_start cũng lấy được", () => {
  const raw = `data: ${JSON.stringify({
    type: "content_block_start",
    content_block: { type: "text", text: "trọn khối" },
  })}\n\n`;
  assert.equal(parseSseText(raw).text, "trọn khối");
});
// Gateway báo lỗi giữa stream với HTTP 200. Bỏ qua event này thì ta chỉ thấy
// "không trả về nội dung nào" mà mất hẳn lý do thật.
check("event error giữa stream được bóc ra làm lý do", () => {
  const r = parseSseText(
    sseDelta("một phần") +
      `data: ${JSON.stringify({ type: "error", error: { message: "vượt hạn mức" } })}\n\n`
  );
  assert.equal(r.error, "vượt hạn mức");
});
check("một dòng data hỏng cú pháp không làm mất phần còn lại", () => {
  const raw = sseDelta("giữ ") + "data: {khong-phai-json\n\n" + sseDelta("phần tốt");
  assert.equal(parseSseText(raw).text, "giữ phần tốt");
});
check("event không mang nội dung thì không thêm gì vào text", () => {
  for (const t of ["message_start", "ping", "content_block_stop", "message_stop"]) {
    const raw = `data: ${JSON.stringify({ type: t })}\n\n`;
    assert.equal(parseSseText(raw).text, "", t);
  }
});
check("dòng event: và comment SSE bị bỏ qua", () => {
  const raw = "event: ping\n: heartbeat\n\n" + sseDelta("nội dung");
  assert.equal(parseSseText(raw).text, "nội dung");
});
check("SSE rỗng trả text rỗng chứ không crash", () =>
  assert.deepEqual(parseSseText(""), { text: "", error: undefined })
);
// delta rỗng là chuyện bình thường ở đầu stream, không được biến thành "undefined"
check("text_delta thiếu trường text không sinh ra chữ undefined", () => {
  const raw = `data: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta" },
  })}\n\n${sseDelta("thật")}`;
  const { text } = parseSseText(raw);
  assert.ok(!text.includes("undefined"), text);
  assert.equal(text, "thật");
});

console.log("\nlỗi chứng chỉ — phân biệt proxy cắt TLS với cert nội bộ");

// Vì sao tách hai nhánh: cùng mã SELF_SIGNED_CERT_IN_CHAIN nhưng nguyên nhân
// trái ngược. Host nội bộ tự ký là bình thường; host công khai báo tự ký nghĩa
// là có thiết bị chen vào giữa. Gộp chung thì người dùng đi sửa
// ANTHROPIC_BASE_URL trong khi lỗi không nằm ở đó.
// Đã kiểm chứng bằng HTTPS server dựng tại chỗ: leaf tự ký cho
// DEPTH_ZERO_SELF_SIGNED_CERT, CA tự ký trong chuỗi cho SELF_SIGNED_CERT_IN_CHAIN.
check("host công khai + CA tự ký trong chuỗi => nghi proxy cắt TLS", () => {
  const m = describeFetchFailure(
    nodeFetchError("SELF_SIGNED_CERT_IN_CHAIN"),
    "huy-9router-app.onrender.com"
  );
  assert.ok(m.includes("chen ngang"), m);
  assert.ok(m.includes("NODE_EXTRA_CA_CERTS"), "không chỉ cách chữa");
  assert.ok(
    m.includes("Không phải lỗi ANTHROPIC_BASE_URL"),
    "phải nói rõ đừng đi sửa base URL"
  );
});
check("host nội bộ + cert tự ký => coi là bình thường, chỉ cách nạp CA", () => {
  const m = describeFetchFailure(
    nodeFetchError("SELF_SIGNED_CERT_IN_CHAIN"),
    "ai-gw.noi-bo.local"
  );
  assert.ok(!m.includes("chen ngang"), "không nên nghi proxy với host nội bộ");
  assert.ok(m.includes("NODE_EXTRA_CA_CERTS"), m);
});
// Bẫy đã kiểm chứng: Node đọc NODE_EXTRA_CA_CERTS lúc khởi động tiến trình, nên
// gán vào process.env lúc chạy (tức là ghi trong .env) hoàn toàn vô hiệu
check("mọi lời khuyên về CA đều cảnh báo .env không có tác dụng", () => {
  for (const h of ["huy-9router-app.onrender.com", "ai-gw.noi-bo.local"]) {
    const m = describeFetchFailure(nodeFetchError("SELF_SIGNED_CERT_IN_CHAIN"), h);
    assert.ok(/\.env (không|sẽ không)/.test(m), `thiếu cảnh báo .env: ${h}`);
  }
});
check("altname sai thì chỉ vào tên miền, không đòi cài CA", () => {
  const m = describeFetchFailure(nodeFetchError("ERR_TLS_CERT_ALTNAME_INVALID"), H);
  assert.ok(m.includes("tên miền khác"), m);
  assert.ok(!m.includes("NODE_EXTRA_CA_CERTS"), "cài CA không chữa được lỗi này");
});
check("isPublicHost: tên miền thật là công khai", () => {
  for (const h of [
    "huy-9router-app.onrender.com",
    "api.anthropic.com",
    "8.8.8.8",
    "ai-gateway.asia-southeast1.run.app:443",
  ])
    assert.equal(isPublicHost(h), true, h);
});
check("isPublicHost: localhost, dải private, đuôi nội bộ là không công khai", () => {
  for (const h of [
    "localhost",
    "localhost:5510",
    "127.0.0.1",
    "10.20.30.40:8443",
    "192.168.1.9",
    "172.16.0.1",
    "172.31.255.254",
    "169.254.1.1",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "gateway", // tên máy đơn trong LAN, không có dấu chấm
    "ai-gw.noi-bo.local",
    "svc.internal",
    "box.lan",
    "gw.corp",
  ])
    assert.equal(isPublicHost(h), false, h);
});
// 172.x chỉ private trong 16-31; 172.15 và 172.32 là địa chỉ công khai thật
check("isPublicHost: biên dải 172.16/12 tính đúng", () => {
  assert.equal(isPublicHost("172.15.0.1"), true);
  assert.equal(isPublicHost("172.32.0.1"), true);
  assert.equal(isPublicHost("172.16.0.1"), false);
  assert.equal(isPublicHost("172.31.0.1"), false);
});

console.log("\nredactSecrets — bí mật không được ra khỏi server");

// Vì sao có nhóm này: body lỗi của gateway được ghép nguyên văn vào thông báo
// trả về trình duyệt. Một số gateway vọng lại toàn bộ request header khi trả
// 401, tức là đẩy chính API key ra client. Đã tái hiện được bằng gateway giả.
check("key đúng trong env bị che dù ở dạng nào", () => {
  const old = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "KEY-RAT-BI-MAT-123456789";
  try {
    const out = redactSecrets(
      'lỗi: {"received":{"x-custom":"KEY-RAT-BI-MAT-123456789"}}'
    );
    assert.ok(!out.includes("KEY-RAT-BI-MAT"), out);
  } finally {
    process.env.ANTHROPIC_API_KEY = old;
  }
});
check("header authorization dạng Bearer bị che", () => {
  const out = redactSecrets('{"authorization":"Bearer abcdef1234567890"}');
  assert.ok(!out.includes("abcdef1234567890"), out);
});
check("khoá dạng sk- bị che dù không khớp env", () => {
  const out = redactSecrets("thử với sk-ant-api03-KHONG-PHAI-KEY-CUA-TA");
  assert.ok(!out.includes("KHONG-PHAI-KEY"), out);
  assert.ok(out.includes("sk-…"), out);
});
check("x-api-key trong JSON bị che", () => {
  const out = redactSecrets('{"x-api-key":"zzzz1111yyyy2222"}');
  assert.ok(!out.includes("zzzz1111yyyy2222"), out);
});
// Key ngắn bất thường: replaceAll một chuỗi 2-3 ký tự sẽ băm nát cả câu, mà key
// thật không bao giờ ngắn thế — nên phải bỏ qua chứ không che
check("key quá ngắn thì bỏ qua, không băm nát câu", () => {
  const old = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "ab";
  try {
    assert.equal(redactSecrets("gateway trả về abc"), "gateway trả về abc");
  } finally {
    process.env.ANTHROPIC_API_KEY = old;
  }
});
check("văn bản sạch thì giữ nguyên, không sửa oan", () => {
  const s = 'model "combo-poco" không tồn tại';
  assert.equal(redactSecrets(s), s);
});
check("nhánh mặc định của describeFetchFailure cũng được redact", () => {
  const e = new TypeError(
    "proxy https://u:sk-ant-BI-MAT-987654321@gw/x không dùng được"
  );
  const m = describeFetchFailure(e, H);
  assert.ok(!m.includes("BI-MAT-987654321"), m);
});

/* ---------- bản sao logic cần kiểm tra: sepayQrUrl (src/lib/qr.ts) ---------- */
// Bản sao 1:1 phần sinh URL; findBank ở đây chỉ tra trong bảng rút gọn dùng
// riêng cho test, không phải bảng banks.ts đầy đủ.
const TEST_BANKS = [
  { id: "VCB", sepayCode: "Vietcombank" },
  { id: "MB", sepayCode: "MBBank" },
  { id: "CAKE", sepayCode: undefined },
];
function testFindBank(id) {
  return TEST_BANKS.find((b) => b.id === id);
}
function sepayQrUrl(args) {
  const { bankId, accountNumber, amount, description } = args;
  const bank = testFindBank(bankId);
  if (!bank?.sepayCode || !accountNumber.trim()) return null;

  const params = new URLSearchParams();
  params.set("acc", accountNumber.trim());
  params.set("bank", bank.sepayCode);
  if (amount && amount > 0) params.set("amount", String(Math.round(amount)));
  if (description && description.trim())
    params.set("des", description.trim().slice(0, 100));

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

console.log("\nsepayQrUrl — sinh URL QR VietQR động của SePay");
check("ngân hàng có sepayCode sinh đúng URL đủ acc+bank+amount+des", () => {
  const url = sepayQrUrl({
    bankId: "VCB",
    accountNumber: "0123456789",
    amount: 150_000,
    description: "Nguyen Van A tra no",
  });
  assert.equal(
    url,
    "https://qr.sepay.vn/img?acc=0123456789&bank=Vietcombank&amount=150000&des=Nguyen+Van+A+tra+no"
  );
});
check("không có amount/description vẫn ra URL hợp lệ chỉ acc+bank", () => {
  const url = sepayQrUrl({ bankId: "MB", accountNumber: "999" });
  assert.equal(url, "https://qr.sepay.vn/img?acc=999&bank=MBBank");
});
check("ngân hàng chưa có sepayCode (CAKE) trả null", () => {
  assert.equal(
    sepayQrUrl({ bankId: "CAKE", accountNumber: "123" }),
    null
  );
});
check("bankId không tồn tại trong danh sách trả null", () => {
  assert.equal(
    sepayQrUrl({ bankId: "KHONG-CO", accountNumber: "123" }),
    null
  );
});
check("số tài khoản chỉ toàn khoảng trắng trả null", () => {
  assert.equal(sepayQrUrl({ bankId: "VCB", accountNumber: "   " }), null);
});
check("amount âm hoặc 0 bị bỏ qua, không đưa vào URL", () => {
  const url = sepayQrUrl({ bankId: "VCB", accountNumber: "1", amount: 0 });
  assert.ok(!url.includes("amount"));
});
check("description dài hơn 100 ký tự bị cắt", () => {
  const longDes = "a".repeat(150);
  const url = sepayQrUrl({
    bankId: "VCB",
    accountNumber: "1",
    description: longDes,
  });
  const des = new URL(url).searchParams.get("des");
  assert.equal(des.length, 100);
});

/* ---------- lịch cron cho backup ---------- */

check("lịch 23:00 mỗi ngày khớp đúng phút, lệch một phút là không khớp", () => {
  const f = parseCron("0 23 * * *");
  assert.ok(cronMatches(f, new Date(2026, 7, 7, 23, 0)));
  assert.ok(!cronMatches(f, new Date(2026, 7, 7, 23, 1)));
  assert.ok(!cronMatches(f, new Date(2026, 7, 7, 22, 0)));
});
check("*/6 ở trường giờ chỉ khớp 0, 6, 12, 18", () => {
  const f = parseCron("0 */6 * * *");
  assert.deepEqual([...f.hour].sort((a, b) => a - b), [0, 6, 12, 18]);
  assert.ok(cronMatches(f, new Date(2026, 7, 7, 12, 0)));
  assert.ok(!cronMatches(f, new Date(2026, 7, 7, 13, 0)));
});
check("danh sách và khoảng cùng lúc: 0,30 ở phút và 9-11 ở giờ", () => {
  const f = parseCron("0,30 9-11 * * *");
  assert.deepEqual([...f.minute].sort((a, b) => a - b), [0, 30]);
  assert.deepEqual([...f.hour].sort((a, b) => a - b), [9, 10, 11]);
  assert.ok(cronMatches(f, new Date(2026, 7, 7, 10, 30)));
  assert.ok(!cronMatches(f, new Date(2026, 7, 7, 10, 15)));
});
check("chỉ định thứ Hai thì thứ Sáu không khớp", () => {
  const f = parseCron("30 2 * * 1");
  // 2026-08-10 là thứ Hai, 2026-08-07 là thứ Sáu.
  assert.ok(cronMatches(f, new Date(2026, 7, 10, 2, 30)));
  assert.ok(!cronMatches(f, new Date(2026, 7, 7, 2, 30)));
});
check("chỉ định ngày 1 thì các ngày khác không khớp, bất kể là thứ mấy", () => {
  const f = parseCron("0 0 1 * *");
  assert.ok(cronMatches(f, new Date(2026, 8, 1, 0, 0)));
  assert.ok(!cronMatches(f, new Date(2026, 8, 2, 0, 0)));
});
check("luật OR của cron: khớp ngày-trong-tháng HOẶC thứ là đủ", () => {
  // Ngày 1 hoặc Chủ nhật — hành vi gây bất ngờ nhất của cron, phải chốt lại.
  const f = parseCron("0 0 1 * 0");
  assert.equal(f.everyDay, false);
  assert.ok(cronMatches(f, new Date(2026, 8, 1, 0, 0)), "ngày 1 (thứ Ba) vẫn khớp");
  assert.ok(cronMatches(f, new Date(2026, 7, 9, 0, 0)), "Chủ nhật 09/08 vẫn khớp");
  assert.ok(!cronMatches(f, new Date(2026, 7, 11, 0, 0)), "thứ Ba 11/08 không khớp");
});
check("trường tháng được tôn trọng", () => {
  const f = parseCron("0 0 * 3 *");
  assert.ok(cronMatches(f, new Date(2026, 2, 15, 0, 0)));
  assert.ok(!cronMatches(f, new Date(2026, 3, 15, 0, 0)));
});
check("thiếu hoặc thừa trường thì báo lỗi rõ số trường nhận được", () => {
  assert.throws(() => parseCron("0 23 * *"), /đúng 5 trường/);
  assert.throws(() => parseCron("0 23 * * * *"), /đúng 5 trường/);
});
check("giá trị ngoài khoảng bị từ chối thay vì im lặng bỏ qua", () => {
  assert.throws(() => parseCron("60 * * * *"), /ngoài khoảng cho phép 0-59/);
  assert.throws(() => parseCron("0 24 * * *"), /ngoài khoảng cho phép 0-23/);
  assert.throws(() => parseCron("0 0 0 * *"), /ngoài khoảng cho phép 1-31/);
  assert.throws(() => parseCron("0 0 * 13 *"), /ngoài khoảng cho phép 1-12/);
  assert.throws(() => parseCron("0 0 * * 7"), /ngoài khoảng cho phép 0-6/);
});
check("cú pháp rác bị từ chối, không âm thầm coi như hợp lệ", () => {
  assert.throws(() => parseCron("abc * * * *"), /không phải số nguyên/);
  assert.throws(() => parseCron("0,,30 * * * *"), /phần tử rỗng/);
  assert.throws(() => parseCron("0 */0 * * *"), /Bước nhảy/);
  assert.throws(() => parseCron("0 */x * * *"), /Bước nhảy/);
  assert.throws(() => parseCron("30-10 * * * *"), /đầu lớn hơn cuối/);
});
check("CRON_SECRET bị gõ nhầm vào BACKUP_CRON vẫn là lịch hợp lệ", () => {
  // Người dùng từng nhầm hai biến này. "5 * * * *" là lịch hợp lệ (phút thứ 5
  // mỗi giờ) nên parser không thể phát hiện — chỉ tài liệu mới chặn được.
  const f = parseCron("5 * * * *");
  assert.ok(cronMatches(f, new Date(2026, 7, 7, 13, 5)));
  assert.equal(describeCron("5 * * * *"), "mỗi giờ vào phút thứ 5");
});
check("mô tả lịch bằng tiếng Việt cho các dạng thường dùng", () => {
  assert.equal(describeCron("0 23 * * *"), "23:00 mỗi ngày");
  assert.equal(describeCron("30 2 * * 1"), '02:30 theo lịch "30 2 * * 1"');
  assert.equal(describeCron("0 */6 * * *"), 'theo lịch "0 */6 * * *"');
});
check("khoảng trắng thừa hai đầu không làm hỏng lịch", () => {
  const f = parseCron("  0   23  *  *  *  ");
  assert.ok(cronMatches(f, new Date(2026, 7, 7, 23, 0)));
  assert.equal(f.everyDay, true);
});
check("* * * * * khớp mọi thời điểm — mốc so sánh cho các luật trên", () => {
  const f = parseCron("* * * * *");
  assert.ok(cronMatches(f, new Date(2026, 0, 1, 0, 0)));
  assert.ok(cronMatches(f, new Date(2026, 11, 31, 23, 59)));
});

/* ---------- bản sao src/lib/gamification.ts (gamification cộng tác) ---------- */
// Suy hoàn toàn từ dữ liệu có sẵn. suggestDirectTransfers là bản sao 1:1 của
// src/lib/balance.ts (khác suggestTransfers ở trên — hàm này tính trực tiếp).

function suggestDirectTransfers(members, bills, settlements, minAmount = 1000) {
  const debt = new Map();
  const addDebt = (fromId, toId, amount) => {
    if (fromId === toId) return;
    if (!debt.has(fromId)) debt.set(fromId, new Map());
    const inner = debt.get(fromId);
    inner.set(toId, (inner.get(toId) ?? 0) + amount);
  };
  for (const b of bills) {
    for (const s of b.shares) {
      if (s.userId !== b.paidBy) addDebt(s.userId, b.paidBy, s.amount);
    }
  }
  for (const s of settlements) addDebt(s.fromUserId, s.toUserId, -s.amount);

  const memberMap = new Map(members.map((m) => [m.userId, m.name]));
  const out = [];
  const visited = new Set();
  for (const [fromId, inner] of debt) {
    for (const [toId] of inner) {
      const key = [fromId, toId].sort().join("-");
      if (visited.has(key)) continue;
      visited.add(key);
      const aOwesB = debt.get(fromId)?.get(toId) ?? 0;
      const bOwesA = debt.get(toId)?.get(fromId) ?? 0;
      const net = Math.round(aOwesB - bOwesA);
      if (net >= minAmount) {
        out.push({ fromUserId: fromId, toUserId: toId, amount: net });
      } else if (net <= -minAmount) {
        out.push({ fromUserId: toId, toUserId: fromId, amount: -net });
      }
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

function isFilledBill(b) {
  return (
    !!b.title && b.title.trim().length > 0 &&
    b.total > 0 &&
    !!b.paidBy &&
    !!b.spentOn && b.spentOn.trim().length > 0
  );
}
function isClearBill(b) {
  return isFilledBill(b) && !!b.category && b.category.trim().length > 0;
}
function isSplitBill(b) {
  if (!b.shares || b.shares.length === 0) return false;
  const sum = b.shares.reduce((acc, s) => acc + s.amount, 0);
  const tolerance = Math.max(1, b.shares.length);
  return Math.abs(sum - b.total) <= tolerance;
}
function participantIds(bills) {
  const ids = new Set();
  for (const b of bills) for (const s of b.shares) ids.add(s.userId);
  return ids;
}
function everyoneParticipates(members, bills) {
  if (members.length === 0 || bills.length === 0) return false;
  const ids = participantIds(bills);
  return members.every((m) => ids.has(m.userId));
}
function remainingTransferCount(members, bills, settlements) {
  return suggestDirectTransfers(members, bills, settlements).length;
}

function groupProgress(members, bills, settlements) {
  const hasBill = bills.some(isFilledBill);
  const confirmed = everyoneParticipates(members, bills);
  const allSplit = bills.length > 0 && bills.every(isSplitBill);
  const done = hasBill && remainingTransferCount(members, bills, settlements) === 0;
  const steps = [
    { key: "created", done: hasBill },
    { key: "confirmed", done: confirmed },
    { key: "split", done: allSplit },
    { key: "done", done },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length };
}

function computeBadges(input) {
  const { members, bills, settlements } = input;
  const bankSet = new Set(input.bankAccountUserIds ?? []);
  const clearBills = bills.filter(isClearBill);
  const fullSplit = bills.some(
    (b) =>
      b.shares.length > 0 &&
      members.length > 0 &&
      members.every((m) => b.shares.some((s) => s.userId === m.userId))
  );
  const qrRescue = settlements.some((s) => bankSet.has(s.toUserId));
  const paidCount = new Map();
  for (const b of clearBills) paidCount.set(b.paidBy, (paidCount.get(b.paidBy) ?? 0) + 1);
  const goodOrganizer = [...paidCount.values()].some((c) => c >= 3);
  const transparent = !!input.exportedStatement;
  return [
    { id: "bill-ro-rang", earned: clearBills.length > 0 },
    { id: "chia-deu-dep", earned: fullSplit },
    { id: "qr-cuu-nguy", earned: qrRescue },
    { id: "nguoi-to-chuc-tot", earned: goodOrganizer },
    { id: "thang-minh-bach", earned: transparent },
  ];
}

function teamEnergy(members, bills, settlements, opts) {
  if (bills.length === 0) return { state: "starting" };
  const confirmed = everyoneParticipates(members, bills);
  const debtsHandled = remainingTransferCount(members, bills, settlements) === 0;
  const shared = !!opts?.exportedStatement;
  const score = (confirmed ? 1 : 0) + (debtsHandled ? 1 : 0) + (shared ? 1 : 0);
  const state =
    score >= 3 ? "done" : score === 2 ? "flowing" : score === 1 ? "coordinating" : "starting";
  return { state };
}

function contextTasks(members, bills, settlements, opts) {
  const tasks = [];
  const pending = bills.filter((b) => !isSplitBill(b) || !isClearBill(b));
  if (pending.length > 0) tasks.push({ id: "don-bill-cho", count: pending.length });
  const remaining = remainingTransferCount(members, bills, settlements);
  if (remaining > 0) tasks.push({ id: "chot-nhom-hom-nay", count: remaining });
  if (bills.length > 0 && !everyoneParticipates(members, bills)) {
    const ids = participantIds(bills);
    const missing = members.filter((m) => !ids.has(m.userId)).length;
    if (missing > 0) tasks.push({ id: "cung-kiem-tra", count: missing });
  }
  if (bills.length > 0 && remaining === 0 && !opts?.exportedStatement) {
    tasks.push({ id: "gui-sao-ke", count: 1 });
  }
  return tasks;
}

console.log("\ngroupProgress — 4 bước hoàn tất một chu kỳ");

const gMembers = [
  { userId: 1, name: "An" },
  { userId: 2, name: "Bình" },
  { userId: 3, name: "Chi" },
];

// Bill An ứng, cả 3 người cùng chia đều → xác nhận đủ + chia xong.
const fullBill = {
  title: "Ăn trưa",
  category: "an-uong",
  total: 300_000,
  paidBy: 1,
  spentOn: "2026-08-01",
  shares: [
    { userId: 1, amount: 100_000 },
    { userId: 2, amount: 100_000 },
    { userId: 3, amount: 100_000 },
  ],
};

check("nhóm chưa có bill: chỉ bước tạo bill chưa xong, không hoàn tất", () => {
  const p = groupProgress(gMembers, [], []);
  assert.equal(p.doneCount, 0);
  assert.equal(p.complete, false);
});

check("có bill đủ + mọi người tham gia nhưng chưa trả nợ: 3/4 bước", () => {
  const p = groupProgress(gMembers, [fullBill], []);
  assert.equal(p.steps.find((s) => s.key === "created").done, true);
  assert.equal(p.steps.find((s) => s.key === "confirmed").done, true);
  assert.equal(p.steps.find((s) => s.key === "split").done, true);
  assert.equal(p.steps.find((s) => s.key === "done").done, false);
  assert.equal(p.doneCount, 3);
});

check("trả hết nợ thì đủ 4/4 và complete", () => {
  const settlements = [
    { fromUserId: 2, toUserId: 1, amount: 100_000 },
    { fromUserId: 3, toUserId: 1, amount: 100_000 },
  ];
  const p = groupProgress(gMembers, [fullBill], settlements);
  assert.equal(p.doneCount, 4);
  assert.equal(p.complete, true);
});

check("thiếu một người trong mọi share thì bước 'xác nhận' chưa xong", () => {
  const partial = {
    ...fullBill,
    shares: [
      { userId: 1, amount: 150_000 },
      { userId: 2, amount: 150_000 },
    ],
  };
  const p = groupProgress(gMembers, [partial], []);
  assert.equal(p.steps.find((s) => s.key === "confirmed").done, false);
});

console.log("\ncomputeBadges — huy hiệu suy từ dữ liệu");

check("bill đủ thông tin mở 'Bill rõ ràng' và 'Chia đều đẹp'", () => {
  const badges = computeBadges({ members: gMembers, bills: [fullBill], settlements: [] });
  const by = Object.fromEntries(badges.map((b) => [b.id, b.earned]));
  assert.equal(by["bill-ro-rang"], true);
  assert.equal(by["chia-deu-dep"], true);
});

check("thiếu hạng mục thì không có 'Bill rõ ràng'", () => {
  const noCat = { ...fullBill, category: "" };
  const badges = computeBadges({ members: gMembers, bills: [noCat], settlements: [] });
  assert.equal(badges.find((b) => b.id === "bill-ro-rang").earned, false);
});

check("QR cứu nguy chỉ mở khi người NHẬN có tài khoản ngân hàng", () => {
  const settlements = [{ fromUserId: 2, toUserId: 1, amount: 100_000 }];
  const off = computeBadges({ members: gMembers, bills: [fullBill], settlements });
  assert.equal(off.find((b) => b.id === "qr-cuu-nguy").earned, false);
  const on = computeBadges({
    members: gMembers,
    bills: [fullBill],
    settlements,
    bankAccountUserIds: [1],
  });
  assert.equal(on.find((b) => b.id === "qr-cuu-nguy").earned, true);
});

check("người tổ chức tốt cần ≥3 bill rõ ràng cùng một người ứng", () => {
  const three = [fullBill, fullBill, fullBill];
  const badges = computeBadges({ members: gMembers, bills: three, settlements: [] });
  assert.equal(badges.find((b) => b.id === "nguoi-to-chuc-tot").earned, true);
  const two = computeBadges({ members: gMembers, bills: [fullBill, fullBill], settlements: [] });
  assert.equal(two.find((b) => b.id === "nguoi-to-chuc-tot").earned, false);
});

check("tháng minh bạch mở khi đã xuất sao kê", () => {
  const badges = computeBadges({
    members: gMembers,
    bills: [fullBill],
    settlements: [],
    exportedStatement: true,
  });
  assert.equal(badges.find((b) => b.id === "thang-minh-bach").earned, true);
});

console.log("\nteamEnergy — trạng thái năng lượng nhóm");

check("chưa có bill => đang khởi động", () =>
  assert.equal(teamEnergy(gMembers, [], []).state, "starting")
);
check("có bill, đã xác nhận, chưa trả nợ => đang phối hợp", () =>
  assert.equal(teamEnergy(gMembers, [fullBill], []).state, "coordinating")
);
check("xác nhận + hết nợ => đã vào guồng", () => {
  const settlements = [
    { fromUserId: 2, toUserId: 1, amount: 100_000 },
    { fromUserId: 3, toUserId: 1, amount: 100_000 },
  ];
  assert.equal(teamEnergy(gMembers, [fullBill], settlements).state, "flowing");
});
check("xác nhận + hết nợ + có sao kê => hoàn tất kỳ", () => {
  const settlements = [
    { fromUserId: 2, toUserId: 1, amount: 100_000 },
    { fromUserId: 3, toUserId: 1, amount: 100_000 },
  ];
  assert.equal(
    teamEnergy(gMembers, [fullBill], settlements, { exportedStatement: true }).state,
    "done"
  );
});

console.log("\ncontextTasks — chỉ hiện nhiệm vụ khi có điều kiện thật");

check("nhóm sạch nợ + đủ share + đã có sao kê => không nhiệm vụ nào", () => {
  const settlements = [
    { fromUserId: 2, toUserId: 1, amount: 100_000 },
    { fromUserId: 3, toUserId: 1, amount: 100_000 },
  ];
  const tasks = contextTasks(gMembers, [fullBill], settlements, { exportedStatement: true });
  assert.deepEqual(tasks, []);
});

check("còn nợ thì có nhiệm vụ 'chốt nhóm hôm nay'", () => {
  const tasks = contextTasks(gMembers, [fullBill], []);
  assert.ok(tasks.some((t) => t.id === "chot-nhom-hom-nay"));
});

check("bill thiếu thông tin thì có nhiệm vụ 'dọn bill đang chờ'", () => {
  const messy = { ...fullBill, category: "", shares: [] };
  const tasks = contextTasks(gMembers, [messy], []);
  const t = tasks.find((x) => x.id === "don-bill-cho");
  assert.ok(t);
  assert.equal(t.count, 1);
});

check("sạch nợ nhưng chưa có sao kê => gợi ý gửi sao kê", () => {
  const settlements = [
    { fromUserId: 2, toUserId: 1, amount: 100_000 },
    { fromUserId: 3, toUserId: 1, amount: 100_000 },
  ];
  const tasks = contextTasks(gMembers, [fullBill], settlements);
  assert.ok(tasks.some((t) => t.id === "gui-sao-ke"));
});

console.log(`\n${passed} kiểm tra đã chạy xong.\n`);
