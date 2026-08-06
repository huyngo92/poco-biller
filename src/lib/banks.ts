export type Bank = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  /**
   * Tên/mã ngân hàng theo chuẩn của SePay dùng cho tham số `bank` khi sinh QR
   * VietQR động (xem `sepayQrUrl` trong `qr.ts`). `undefined` = ngân hàng này
   * không nằm trong danh sách SePay hỗ trợ tạo QR — không hiện nút QR.
   * Đối chiếu tay từ các trang qr.sepay.vn/qr-<ten-ngan-hang>.html vì
   * qr.sepay.vn/banks.json không gọi được từ môi trường chạy việc này.
   */
  sepayCode?: string;
};

// Data from https://api.vietqr.io/v2/banks
export const banks: Bank[] = [
  { id: "VCB", name: "Ngân hàng TMCP Ngoại thương Việt Nam", shortName: "Vietcombank", logo: "https://api.vietqr.io/img/VCB.png", sepayCode: "Vietcombank" },
  { id: "ICB", name: "Ngân hàng TMCP Công thương Việt Nam", shortName: "VietinBank", logo: "https://api.vietqr.io/img/ICB.png", sepayCode: "VietinBank" },
  { id: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", shortName: "BIDV", logo: "https://api.vietqr.io/img/BIDV.png", sepayCode: "BIDV" },
  { id: "AGRIBANK", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", shortName: "Agribank", logo: "https://api.vietqr.io/img/AGRIBANK.png", sepayCode: "Agribank" },
  { id: "OCB", name: "Ngân hàng TMCP Phương Đông", shortName: "OCB", logo: "https://api.vietqr.io/img/OCB.png", sepayCode: "OCB" },
  { id: "MB", name: "Ngân hàng TMCP Quân đội", shortName: "MB Bank", logo: "https://api.vietqr.io/img/MB.png", sepayCode: "MBBank" },
  { id: "TCB", name: "Ngân hàng TMCP Kỹ thương Việt Nam", shortName: "Techcombank", logo: "https://api.vietqr.io/img/TCB.png", sepayCode: "Techcombank" },
  { id: "ACB", name: "Ngân hàng TMCP Á Châu", shortName: "ACB", logo: "https://api.vietqr.io/img/ACB.png", sepayCode: "ACB" },
  { id: "VPB", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", shortName: "VPBank", logo: "https://api.vietqr.io/img/VPB.png", sepayCode: "VPBank" },
  { id: "TPB", name: "Ngân hàng TMCP Tiên Phong", shortName: "TPBank", logo: "https://api.vietqr.io/img/TPB.png", sepayCode: "TPBank" },
  { id: "STB", name: "Ngân hàng TMCP Sài Gòn Thương Tín", shortName: "Sacombank", logo: "https://api.vietqr.io/img/STB.png", sepayCode: "Sacombank" },
  { id: "HDB", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh", shortName: "HDBank", logo: "https://api.vietqr.io/img/HDB.png", sepayCode: "HDBank" },
  { id: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam", shortName: "VIB", logo: "https://api.vietqr.io/img/VIB.png", sepayCode: "VIB" },
  { id: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội", shortName: "SHB", logo: "https://api.vietqr.io/img/SHB.png", sepayCode: "SHB" },
  { id: "EIB", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam", shortName: "Eximbank", logo: "https://api.vietqr.io/img/EIB.png", sepayCode: "Eximbank" },
  { id: "MSB", name: "Ngân hàng TMCP Hàng hải Việt Nam", shortName: "MSB", logo: "https://api.vietqr.io/img/MSB.png", sepayCode: "MSB" },
  { id: "CAKE", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank", shortName: "CAKE by VPBank", logo: "https://api.vietqr.io/img/CAKE.png" },
  { id: "Ubank", name: "Ngân hàng số Ubank by VPBank", shortName: "Ubank by VPBank", logo: "https://api.vietqr.io/img/Ubank.png" },
  { id: "Timo", name: "Ngân hàng số Timo", shortName: "Timo", logo: "https://api.vietqr.io/img/Timo.png" },
  { id: "VTLMONEY", name: "Tổng Công ty Dịch vụ số Viettel - Chi nhánh tập đoàn công nghiệp viễn thông Quân Đội", shortName: "Viettel Money", logo: "https://api.vietqr.io/img/VTLMONEY.png" },
  { id: "VNPTMONEY", name: "VNPT Money", shortName: "VNPT Money", logo: "https://api.vietqr.io/img/VNPTMONEY.png" },
  { id: "SACOMBANK", name: "Ngân hàng TMCP Sài Gòn Thương Tín", shortName: "Sacombank", logo: "https://api.vietqr.io/img/SACOMBANK.png", sepayCode: "Sacombank" },
  { id: "SCB", name: "Ngân hàng TMCP Sài Gòn", shortName: "SCB", logo: "https://api.vietqr.io/img/SCB.png", sepayCode: "SCB" },
  { id: "PGBANK", name: "Ngân hàng TMCP Xăng dầu Petrolimex", shortName: "PG Bank", logo: "https://api.vietqr.io/img/PGBANK.png", sepayCode: "PGBank" },
  { id: "LPB", name: "Ngân hàng TMCP Bưu điện Liên Việt", shortName: "LienVietPostBank", logo: "https://api.vietqr.io/img/LPB.png", sepayCode: "LienVietPostBank" },
  { id: "SEAB", name: "Ngân hàng TMCP Đông Nam Á", shortName: "SeABank", logo: "https://api.vietqr.io/img/SEAB.png", sepayCode: "SeABank" },
  { id: "ABB", name: "Ngân hàng TMCP An Bình", shortName: "ABBank", logo: "https://api.vietqr.io/img/ABB.png", sepayCode: "ABBANK" },
  { id: "VIETABANK", name: "Ngân hàng TMCP Việt Á", shortName: "VietABank", logo: "https://api.vietqr.io/img/VIETABANK.png", sepayCode: "VietABank" },
  { id: "NASB", name: "Ngân hàng TMCP Bắc Á", shortName: "Bac A Bank", logo: "https://api.vietqr.io/img/NASB.png", sepayCode: "BacABank" },
  { id: "BVB", name: "Ngân hàng TMCP Bảo Việt", shortName: "BaoViet Bank", logo: "https://api.vietqr.io/img/BVB.png", sepayCode: "BaoVietBank" },
  { id: "VRB", name: "Ngân hàng liên doanh Việt - Nga", shortName: "VRB", logo: "https://api.vietqr.io/img/VRB.png", sepayCode: "VRB" },
  { id: "CIMB", name: "Ngân hàng TNHH MTV CIMB Việt Nam", shortName: "CIMB", logo: "https://api.vietqr.io/img/CIMB.png", sepayCode: "CIMB" },
  { id: "HSBC", name: "Ngân hàng TNHH MTV HSBC (Việt Nam)", shortName: "HSBC", logo: "https://api.vietqr.io/img/HSBC.png", sepayCode: "HSBC" },
  { id: "WOORI", name: "Ngân hàng TNHH MTV Woori Việt Nam", shortName: "Woori Bank", logo: "https://api.vietqr.io/img/WOORI.png" },
];

export function findBank(id: string): Bank | undefined {
  return banks.find((b) => b.id === id);
}