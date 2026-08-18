/**
 * Bộ avatar minh hoạ của Poco — mỗi avatar là một ảnh tròn trong public/avatars.
 * Có 12 ảnh (av-1..av-12). Vẫn resolve được các id cũ đã lưu trong DB
 * (cat, dog, bear, …) bằng cách ánh xạ tất định sang một trong 12 ảnh, nên dữ
 * liệu cũ không vỡ khi đổi bộ avatar.
 */

export type PresetAvatar = {
  id: string;
  label: string;
  src: string; // đường dẫn ảnh tròn trong /public
};

const COUNT = 12;

export const AVATARS: PresetAvatar[] = Array.from({ length: COUNT }, (_, i) => ({
  id: `av-${i + 1}`,
  label: `Ảnh đại diện ${i + 1}`,
  src: `/avatars/av-${i + 1}.png`,
}));

// Các id avatar cũ (emoji) từng lưu trong DB — ánh xạ sang ảnh mới cho ổn định.
const LEGACY_IDS = [
  "cat", "dog", "bear", "rabbit", "fox", "panda", "koala", "lion", "monkey",
  "penguin", "owl", "unicorn", "dragon", "octopus", "frog", "tiger", "whale",
  "chick", "pig", "mouse",
];

/** Băm tất định một chuỗi id bất kỳ về 1..COUNT (dùng cho id lạ/cũ). */
function hashToIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % COUNT) + 1;
}

/**
 * Trả về avatar cho một id.
 * - id mới "av-N" → dùng trực tiếp.
 * - id cũ (cat, dog, …) hoặc id lạ → ánh xạ tất định sang một av-N.
 */
export function getAvatar(id: string): PresetAvatar | undefined {
  if (!id) return undefined;
  const direct = AVATARS.find((a) => a.id === id);
  if (direct) return direct;
  // id cũ theo danh sách → giữ đúng thứ tự cũ để phân bổ đều
  const legacyPos = LEGACY_IDS.indexOf(id);
  const n = legacyPos >= 0 ? (legacyPos % COUNT) + 1 : hashToIndex(id);
  return AVATARS[n - 1];
}

export function randomAvatar(): PresetAvatar {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/** Chữ cái đầu của tên — fallback khi chưa chọn avatar */
export function initials(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

// ---- Icon hạng mục chi tiêu (public/categories/{id}.png) ----

const CATEGORY_ICON_IDS = new Set([
  "an-uong", "ca-phe", "di-lai", "luu-tru", "giai-tri", "mua-sam", "hoa-don",
  "khac",
]);

/** Đường dẫn icon minh hoạ cho một hạng mục; hạng mục lạ → "khac". */
export function categoryIcon(id: string): string {
  const key = CATEGORY_ICON_IDS.has(id) ? id : "khac";
  return `/categories/${key}.png`;
}
