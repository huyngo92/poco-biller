/**
 * Bộ avatar có sẵn — mỗi avatar là một id + màu nền + SVG path.
 * Kiểu đơn giản, vui mắt, giống Splitwise.
 */

export type PresetAvatar = {
  id: string;
  label: string;
  bg: string;       // CSS background
  emoji: string;    // dùng emoji cho đơn giản, render bằng text trong vòng tròn
};

// ponytail: dùng emoji thay SVG path — nhanh, gọn, đủ dùng.
// Nâng cấp thành SVG custom khi cần branding riêng.
export const AVATARS: PresetAvatar[] = [
  { id: "cat",       label: "Mèo",       bg: "#FF6B6B", emoji: "🐱" },
  { id: "dog",       label: "Chó",        bg: "#4ECDC4", emoji: "🐶" },
  { id: "bear",      label: "Gấu",        bg: "#FFD93D", emoji: "🐻" },
  { id: "rabbit",    label: "Thỏ",        bg: "#FF8FA3", emoji: "🐰" },
  { id: "fox",       label: "Cáo",        bg: "#FF9F43", emoji: "🦊" },
  { id: "panda",     label: "Gấu trúc",   bg: "#A8E6CF", emoji: "🐼" },
  { id: "koala",     label: "Gấu túi",    bg: "#95B8D1", emoji: "🐨" },
  { id: "lion",      label: "Sư tử",      bg: "#F4A460", emoji: "🦁" },
  { id: "monkey",    label: "Khỉ",        bg: "#DDA0DD", emoji: "🐵" },
  { id: "penguin",   label: "Chim cánh cụt", bg: "#87CEEB", emoji: "🐧" },
  { id: "owl",       label: "Cú",         bg: "#C9B1FF", emoji: "🦉" },
  { id: "unicorn",   label: "Kỳ lân",     bg: "#FF69B4", emoji: "🦄" },
  { id: "dragon",    label: "Rồng",       bg: "#98D8C8", emoji: "🐲" },
  { id: "octopus",   label: "Bạch tuộc",  bg: "#F7DC6F", emoji: "🐙" },
  { id: "frog",      label: "Ếch",        bg: "#82E0AA", emoji: "🐸" },
  { id: "tiger",     label: "Hổ",         bg: "#F0B27A", emoji: "🐯" },
  { id: "whale",     label: "Cá voi",     bg: "#85C1E9", emoji: "🐳" },
  { id: "chick",     label: "Gà con",     bg: "#FAD7A0", emoji: "🐥" },
  { id: "pig",       label: "Heo",        bg: "#F5B7B1", emoji: "🐷" },
  { id: "mouse",     label: "Chuột",      bg: "#D5D8DC", emoji: "🐭" },
];

export function getAvatar(id: string): PresetAvatar | undefined {
  return AVATARS.find((a) => a.id === id);
}

export function randomAvatar(): PresetAvatar {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/** Chữ cái đầu của tên — fallback khi chưa chọn avatar */
export function initials(name: string): string {
  return name.charAt(0).toUpperCase();
}
