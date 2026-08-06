# 🧾 Poco Biller

Chia bill nhóm mà không cần mở Excel. Ghi lại ai ứng tiền, ai ăn gì, rồi để app tự tính ai nợ ai và gợi ý cách trả gọn nhất.

Ba cách nhập liệu, tuỳ lúc bạn rảnh tay tới đâu: chụp ảnh hoá đơn cho AI đọc, gõ một câu tiếng Việt kiểu *"tối qua lẩu 1tr2, mình ứng, chia đều cho Huy, Lan và Trung"* rồi để AI chia hộ, hoặc nhập tay khi muốn chắc từng đồng.

## Vì sao lại làm cái này

Nhóm bạn/team nào cũng có vài lượt ứng tiền linh tinh mỗi tuần — ăn trưa, cà phê, taxi, mua chung đồ. Nhớ bằng miệng thì quên, ghi vào chat thì trôi mất, làm sheet thì ai cũng lười mở. Poco Biller gói gọn lại: ghi một dòng, xem số dư theo tuần/tháng/quý, và tới lúc cần "chốt sổ" thì có sẵn tin nhắn để dán vào group chat.

## Tính năng

**Bốn cách chia tiền** — chia đều, theo phần (A hai phần, B một phần), theo phần trăm, hoặc nhập tay từng người. Đồng lẻ không chia hết luôn được rải cho đúng, tổng các phần không bao giờ lệch bill gốc dù chỉ một đồng.

**Nhắc nợ thông minh** — thay vì mỗi người trả từng người, app gộp lại thành ít giao dịch nhất có thể. Mỗi khoản nợ có nút xác nhận hai chiều (người trả xác nhận đã chuyển, người nhận xác nhận đã nhận), nút copy lời nhắc kèm QR chuyển khoản, và một bản tóm tắt để dán thẳng lên group chat.

**Nhập liệu bằng AI** — chụp hoá đơn hoặc gõ một câu, AI đọc ra số tiền, người tham gia, tỷ lệ chia. Số tiền cuối cùng luôn được tính lại ở server để khớp đúng tổng bill, kể cả khi AI đoán lệch.

**Sao lưu không phụ thuộc ai** — xuất JSON/CSV bất cứ lúc nào, và tự động đẩy CSV lên Google Drive mỗi ngày nếu bạn muốn.

## Công nghệ

Next.js 15 (App Router) + SQLite (`better-sqlite3`) + CSS viết tay, phong cách Apple HIG. Chỉ năm dependency runtime nên cài nhanh, chạy nhẹ, không có tầng phức tạp thừa thãi.

## Bắt đầu

```bash
npm install
cp .env.example .env
npm run dev
```

Hướng dẫn cấu hình đầy đủ (AI, Google Drive, triển khai production, xử lý lỗi mạng...) nằm ở [SETUP.md](./SETUP.md).

## Kiểm tra logic tiền tệ

```bash
npm test
```

110 assertion cho các phần dễ sai nhất: chia tiền luôn khớp tổng, số dư cả nhóm luôn về 0, số giao dịch gợi ý tối giản, và không bao giờ để lộ secret ra thông báo lỗi.

---

Tiền lưu bằng số nguyên VND — không bao giờ có sai số làm tròn.
