/**
 * Lớp icon duy nhất của app.
 *
 * Nguồn: lucide-react — chọn vì hình dạng gần SF Symbols nhất trong các bộ
 * open-source (grid 24, đầu nét bo tròn, đường cong 2px).
 *
 * Quy ước theo Apple HIG:
 * - Chỉ dùng icon qua file này. Không import trực tiếp `lucide-react` ở nơi khác,
 *   để size và độ dày nét luôn nhất quán.
 * - Kích thước lấy từ thang SF Symbols: 17 (inline cạnh chữ), 20 (nút),
 *   22 (tab bar), 28 (điểm nhấn). Đặt qua prop `size` hoặc CSS var --icon-size.
 * - Độ dày nét 1.75 ứng với SF Symbols weight Regular ở scale Medium.
 * - Icon đứng một mình trong nút thì nút phải có aria-label; icon luôn
 *   aria-hidden vì nó chỉ là lớp trang trí cho nhãn chữ.
 */

import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Copy,
  FileJson,
  FileSpreadsheet,
  Image as ImageBase,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  PlusCircle,
  ReceiptText,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  UserPlus,
  X,
  type LucideProps,
} from "lucide-react";

/** Nét 1.75 = SF Symbols Regular. Tuyệt đối không đổi lẻ ở từng chỗ dùng. */
const STROKE = 1.75;

/** Thang size SF Symbols. `md` là mặc định cho nút. */
export const ICON_SIZE = {
  sm: 17,
  md: 20,
  tab: 22,
  lg: 28,
} as const;

export type IconProps = Omit<LucideProps, "ref"> & {
  /** Tô nhạt phần thân icon — thay cho biến thể `.fill` của SF Symbols. */
  filled?: boolean;
};

/**
 * Bọc một icon Lucide thành icon của app: khoá stroke, mặc định size 20,
 * ẩn khỏi screen reader, và cho phép biến thể "filled" kiểu SF Symbols.
 */
function wrap(Base: React.ComponentType<LucideProps>, displayName: string) {
  function Icon({ filled, size, ...rest }: IconProps) {
    return (
      <Base
        aria-hidden="true"
        focusable="false"
        size={size ?? ICON_SIZE.md}
        strokeWidth={STROKE}
        /* Giữ nét dày đúng 1.75px thật ở mọi size. Không có cờ này, Lucide
           scale nét theo viewBox nên icon 17px trông mảnh hơn icon 28px. */
        absoluteStrokeWidth
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : undefined}
        {...rest}
      />
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/* ---------- Điều hướng ---------- */

/** Tab "Sổ bill" — SF: doc.plaintext */
export const IconLedger = wrap(ReceiptText, "IconLedger");
/** Tab "Thêm bill" — SF: plus.circle */
export const IconAdd = wrap(PlusCircle, "IconAdd");
/** Tab "Nhắc nợ" — SF: bell */
export const IconBell = wrap(Bell, "IconBell");
/** Tab "Cài đặt" — SF: gearshape */
export const IconGear = wrap(Settings, "IconGear");

/** Nút back của nav bar — SF: chevron.left */
export const IconBack = wrap(ChevronLeft, "IconBack");
/** Mũi nhọn cuối dòng list bấm được — SF: chevron.right */
export const IconChevron = wrap(ChevronRight, "IconChevron");
/** Đóng sheet — SF: xmark */
export const IconClose = wrap(X, "IconClose");
/** Mũi tên nợ → người nhận trong thẻ nhắc nợ — SF: arrow.right */
export const IconArrowRight = wrap(ArrowRight, "IconArrowRight");

/* ---------- Nhập liệu ---------- */

/** SF: camera */
export const IconCamera = wrap(Camera, "IconCamera");
/** SF: text.bubble */
export const IconChat = wrap(MessageSquareText, "IconChat");
/** SF: square.and.pencil */
export const IconPen = wrap(SquarePen, "IconPen");
/** Tính năng AI — SF: sparkles */
export const IconSparkles = wrap(Sparkles, "IconSparkles");

/* ---------- Hành động ---------- */

/** SF: doc.on.doc */
export const IconCopy = wrap(Copy, "IconCopy");
/** Copy ảnh QR — SF: photo */
export const IconImage = wrap(ImageBase, "IconImage");
/** SF: checkmark */
export const IconCheck = wrap(Check, "IconCheck");
/** SF: trash */
export const IconTrash = wrap(Trash2, "IconTrash");
/** SF: rectangle.portrait.and.arrow.right */
export const IconSignOut = wrap(LogOut, "IconSignOut");
/** SF: person.badge.plus */
export const IconMemberAdd = wrap(UserPlus, "IconMemberAdd");
/** SF: arrow.left.arrow.right */
export const IconSettle = wrap(ArrowLeftRight, "IconSettle");

/* ---------- Dữ liệu, sao lưu ---------- */

/** SF: icloud.and.arrow.up */
export const IconCloudUp = wrap(CloudUpload, "IconCloudUp");
/** SF: curlybraces */
export const IconFileJson = wrap(FileJson, "IconFileJson");
/** SF: tablecells */
export const IconFileCsv = wrap(FileSpreadsheet, "IconFileCsv");

/* ---------- Trạng thái ---------- */

/** SF: exclamationmark.circle */
export const IconAlert = wrap(CircleAlert, "IconAlert");
/** SF: checkmark.circle */
export const IconOk = wrap(CircleCheck, "IconOk");

/**
 * Vòng xoay chờ. Animation nằm ở class `.spinner` trong globals.css để
 * `prefers-reduced-motion` vô hiệu hoá được.
 */
const Spinner = wrap(LoaderCircle, "IconSpinner");
export function IconSpinner(props: IconProps) {
  return <Spinner {...props} className={`spinner ${props.className ?? ""}`} />;
}
