import { findBank } from "./banks";

/**
 * Sinh URL ảnh QR VietQR động của SePay (miễn phí, không cần đăng ký) theo
 * mẫu tại https://qr.sepay.vn/ :
 *   https://qr.sepay.vn/img?acc=SO_TAI_KHOAN&bank=MA_NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG
 *
 * `bank` phải là Code/Short_name theo danh sách SePay công bố (không giống
 * hệt `id`/`shortName` trong `src/lib/banks.ts`, ví dụ "MB Bank" ở ta nhưng
 * SePay dùng "MBBank") — nên map qua field `sepayCode` của mỗi bank thay vì
 * truyền thẳng id/shortName.
 *
 * Đây là dịch vụ công khai của bên thứ ba, không phải hệ thống nội bộ VIB:
 * chỉ gửi số tài khoản + số tiền + nội dung ra ngoài, không gửi tên chủ tài
 * khoản hay bất kỳ dữ liệu khách hàng/nhân viên nào khác qua URL này.
 */
export function sepayQrUrl(args: {
  bankId: string;
  accountNumber: string;
  amount?: number;
  description?: string;
}): string | null {
  const { bankId, accountNumber, amount, description } = args;
  const bank = findBank(bankId);
  if (!bank?.sepayCode || !accountNumber.trim()) return null;

  const params = new URLSearchParams();
  params.set("acc", accountNumber.trim());
  params.set("bank", bank.sepayCode);
  if (amount && amount > 0) params.set("amount", String(Math.round(amount)));
  if (description && description.trim())
    params.set("des", description.trim().slice(0, 100));

  return `https://qr.sepay.vn/img?${params.toString()}`;
}
