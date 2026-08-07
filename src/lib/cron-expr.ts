/**
 * Đọc biểu thức cron 5 trường để app tự hẹn giờ backup, không cần crontab.
 *
 * Cố ý chỉ nhận đúng cú pháp cron tiêu chuẩn và báo lỗi rõ ràng khi sai, vì
 * lịch gõ sai mà vẫn im lặng chạy là kiểu lỗi tệ nhất với một tính năng backup:
 * mọi thứ trông như bình thường cho tới hôm cần khôi phục mới biết không có bản
 * nào. Thà từ chối khởi động scheduler còn hơn.
 *
 *   phút  giờ  ngày-trong-tháng  tháng  thứ
 *   0     23   *                 *      *      → 23:00 mỗi ngày
 *   30    2    *                 *      1      → 02:30 mỗi thứ Hai
 *   0     *​/6  *                 *      *      → mỗi 6 tiếng
 */

export type CronFields = {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  /** trường "ngày trong tháng" có được chỉ định cụ thể (khác "*") hay không */
  domRestricted: boolean;
  /** trường "thứ" có được chỉ định cụ thể (khác "*") hay không */
  dowRestricted: boolean;
  /** true khi cả hai trường ngày đều là "*" — nghĩa là chạy mọi ngày */
  everyDay: boolean;
};

const RANGES: [number, number][] = [
  [0, 59], // phút
  [0, 23], // giờ
  [1, 31], // ngày trong tháng
  [1, 12], // tháng
  [0, 6], // thứ, 0 = Chủ nhật
];

const FIELD_NAMES = ["phút", "giờ", "ngày trong tháng", "tháng", "thứ"];

function parseField(raw: string, index: number): Set<number> {
  const [min, max] = RANGES[index];
  const out = new Set<number>();

  for (const part of raw.split(",")) {
    const piece = part.trim();
    if (!piece) throw new Error(`Trường ${FIELD_NAMES[index]} có phần tử rỗng.`);

    const [spec, stepRaw] = piece.split("/");
    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1)
        throw new Error(`Bước nhảy "${stepRaw}" ở trường ${FIELD_NAMES[index]} không hợp lệ.`);
    }

    let from: number;
    let to: number;
    if (spec === "*") {
      from = min;
      to = max;
    } else if (spec.includes("-")) {
      const [a, b] = spec.split("-");
      from = Number(a);
      to = Number(b);
      if (!Number.isInteger(from) || !Number.isInteger(to))
        throw new Error(`Khoảng "${spec}" ở trường ${FIELD_NAMES[index]} không hợp lệ.`);
      if (from > to)
        throw new Error(`Khoảng "${spec}" ở trường ${FIELD_NAMES[index]} có đầu lớn hơn cuối.`);
    } else {
      from = Number(spec);
      to = from;
      if (!Number.isInteger(from))
        throw new Error(`Giá trị "${spec}" ở trường ${FIELD_NAMES[index]} không phải số nguyên.`);
    }

    if (from < min || to > max)
      throw new Error(
        `Giá trị "${spec}" ở trường ${FIELD_NAMES[index]} ngoài khoảng cho phép ${min}-${max}.`
      );

    for (let v = from; v <= to; v += step) out.add(v);
  }

  return out;
}

export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5)
    throw new Error(
      `Lịch cron phải có đúng 5 trường (phút giờ ngày tháng thứ), nhận được ${parts.length}: "${expr.trim()}".`
    );

  return {
    minute: parseField(parts[0], 0),
    hour: parseField(parts[1], 1),
    dayOfMonth: parseField(parts[2], 2),
    month: parseField(parts[3], 3),
    dayOfWeek: parseField(parts[4], 4),
    domRestricted: parts[2].trim() !== "*",
    dowRestricted: parts[4].trim() !== "*",
    everyDay: parts[2].trim() === "*" && parts[4].trim() === "*",
  };
}

/**
 * Khớp thời điểm với lịch, theo giờ địa phương của máy chạy app.
 *
 * Hai trường ngày theo đúng luật cron của Unix, gồm ba trường hợp:
 *   - cả hai là "*"        → chạy mọi ngày
 *   - chỉ một được chỉ định → xét đúng trường đó, trường "*" bỏ qua hoàn toàn
 *   - cả hai được chỉ định  → khớp MỘT trong hai là đủ (OR)
 *
 * Chỗ dễ sai là trường hợp giữa: nếu coi "*" thành tập đầy đủ rồi OR thì
 * "30 2 * * 1" (02:30 mỗi thứ Hai) sẽ khớp mọi ngày, tức lịch hằng tuần âm thầm
 * biến thành hằng ngày. Đã có test cho đúng ca này trong scripts/test-logic.mjs.
 */
export function cronMatches(fields: CronFields, at: Date): boolean {
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

/** Mô tả lịch bằng tiếng Việt để in ra log lúc khởi động, cho dễ soi. */
export function describeCron(expr: string): string {
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
