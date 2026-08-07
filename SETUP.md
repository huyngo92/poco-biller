# Cài đặt & vận hành

## Chạy lần đầu

```bash
npm install
cp .env.example .env
```

Mở `.env` và đặt `SESSION_SECRET` thành một chuỗi ngẫu nhiên dài. Có thể sinh bằng:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Rồi chạy:

```bash
npm run dev
```

Mở http://localhost:3000, bấm "Tạo tài khoản mới". Hệ thống tự tạo sẵn một nhóm cho bạn kèm mã mời sáu ký tự, xem ở tab Cài đặt. File database nằm ở `data/poco.db` và được tạo tự động.

## Thêm người vào nhóm

Hai cách. Gửi mã mời để họ tự tạo tài khoản rồi nhập mã ở tab Cài đặt. Hoặc bạn (với quyền quản trị) vào Cài đặt, phần Thêm thành viên, nhập tên và email — hệ thống tạo tài khoản kèm mật khẩu tạm hiện ra một lần, bạn chuyển cho họ để đăng nhập.

## Bật AI OCR và nhập bill bằng chat

Lấy API key ở console.anthropic.com rồi thêm vào `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Khởi động lại server. Từ đó tab Thêm bill có hai chế độ AI hoạt động:

Chụp hoá đơn đọc ra tên quán, tổng tiền, ngày, và danh sách món để bạn đối chiếu. Số tiền chia luôn lấy theo tổng bill, không theo từng món, nên OCR lệch một dòng cũng không làm sai số dư.

Gõ một câu như "Tối qua lẩu 1tr2, mình ứng, chia đều cho Huy, Lan và Trung" hoặc "Cà phê 180k, Lan trả, mình với Lan chia đều". AI đọc ra người ứng tiền, người tham gia, tỷ lệ chia, và cả ngày tương đối như "hôm qua" hay "thứ 6 tuần trước". Số tiền của từng người luôn được tính lại ở phía server để tổng khớp đúng tổng bill, kể cả khi AI trả về số lệch.

Không có key thì hai chế độ này báo lỗi rõ ràng và bạn vẫn nhập tay bình thường.

### Đổi endpoint và model

Mặc định app gọi `https://api.anthropic.com` với model `claude-sonnet-4-5`. Nếu tổ chức của bạn đi qua một gateway trung gian, khai báo trong `.env`:

```
ANTHROPIC_BASE_URL=https://ai-gateway.noi-bo/anthropic
ANTHROPIC_MODEL=claude-sonnet-4-5
```

`ANTHROPIC_BASE_URL` nhận cả ba dạng — gốc host, có `/v1`, hay đầy đủ `/v1/messages` — app tự ghép cho đúng, nên không lo dán thiếu hay thừa đoạn đuôi. Gateway nào chỉ nhận `Authorization: Bearer` thì thêm `ANTHROPIC_AUTH_STYLE=bearer`. Trần token đầu ra đặt qua `ANTHROPIC_MAX_TOKENS` (mặc định 2000).

Vì ảnh hoá đơn là dữ liệu riêng của nhóm, app từ chối endpoint `http://` trỏ ra máy khác. Nếu gateway nội bộ của bạn thật sự chỉ có http, mở bằng `ANTHROPIC_ALLOW_INSECURE_HTTP=1` — localhost thì luôn được phép.

Cấu hình đang có hiệu lực xem ở tab Cài đặt, phần Trợ lý AI: nó hiện endpoint, model, trần token, kiểu xác thực, và cho biết đã có key hay chưa. API key không bao giờ hiển thị ở đó và cũng không nằm trong file sao lưu. Sửa `.env` rồi khởi động lại server thì giá trị mới có hiệu lực.

### Khi AI báo lỗi kết nối

Bấm **Kiểm tra kết nối** ở phần Trợ lý AI để gọi thử một lượt. Nút này gửi một prompt rất ngắn và nói rõ mất bao nhiêu giây, hoặc vướng ở đâu nếu không đi được.

Thông báo lỗi chỉ thẳng nguyên nhân thay vì chỉ nói "fetch failed". "Không tra được tên miền" là sai chính tả trong URL hoặc máy không ra được Internet. "Từ chối kết nối" là tên miền đúng nhưng không có gì lắng nghe ở đó, thường do dịch vụ đã tắt. "Không trả lời trong N giây" hay gặp nhất với dịch vụ chạy gói miễn phí: chúng ngủ sau khoảng mười lăm phút không ai dùng và cần tới một phút để dựng lại, nên lần gọi đầu tiên trong ngày thường trượt — thử lại lần nữa là được. Nếu vẫn muốn chờ lâu hơn thì nới `ANTHROPIC_TIMEOUT_MS`. Còn "trả lỗi 404 với model X" nghĩa là đường đi đã thông và key đã đúng, chỉ là gateway không nhận tên model đó.

### Gateway trả về stream

Anthropic API trả JSON khi không xin stream, nhưng nhiều gateway trung gian luôn stream bất kể yêu cầu, tức là trả `text/event-stream` với các dòng `event: message_start`, `data: {...}`. App đọc được cả hai dạng: nó xin `stream: false` tường minh, và nếu vẫn nhận SSE thì tự gộp các `text_delta` lại. Bạn không cần cấu hình gì.

Một lợi ích kèm theo: gateway báo lỗi giữa lúc stream — hay gặp khi vượt hạn mức token — thì phản hồi vẫn là HTTP 200, lỗi nằm trong một event `error` ở giữa dòng. App bóc event đó ra làm lý do thay vì chỉ nói "không trả về nội dung nào".

Nếu nhận được thứ không phải JSON cũng không phải SSE, thông báo sẽ kèm content-type và đoạn đầu phản hồi. Thường đó là trang riêng của proxy chen giữa: trang đăng nhập, hoặc thông báo chặn truy cập.

### Lỗi chứng chỉ và proxy cắt TLS

Nếu thông báo nói "chuỗi chứng chỉ có một CA tự ký" với một tên miền công khai, nguyên nhân không nằm trong app. Các dịch vụ công khai đều dùng chứng chỉ hợp lệ, nên mã `SELF_SIGNED_CERT_IN_CHAIN` ở đây nghĩa là có thiết bị trên đường mạng — proxy của công ty, hoặc phần mềm diệt virus có tính năng quét HTTPS — đang giải mã kết nối rồi phát lại bằng CA riêng của tổ chức. Node không tin CA đó nên dừng. Sửa `ANTHROPIC_BASE_URL` không giải quyết được gì.

Cách chữa là cho Node biết CA ấy đáng tin. Xin bộ phận IT file CA dạng PEM rồi truyền vào lúc khởi động:

```bash
NODE_EXTRA_CA_CERTS=/duong/dan/ca-noi-bo.pem npm run dev
```

Biến này **phải ở dòng lệnh**. Ghi vào `.env` sẽ không có tác dụng vì Node đọc nó lúc dựng tiến trình, trước khi Next kịp nạp `.env`. Chạy production bằng systemd thì đặt trong `Environment=`, bằng Docker thì `-e`, bằng pm2 thì trong `env` của file cấu hình.

Đừng dùng `NODE_TLS_REJECT_UNAUTHORIZED=0` cho nhanh. Nó tắt kiểm tra chứng chỉ cho mọi kết nối của app, kể cả khi đẩy backup lên GitHub, nên bất kỳ ai chen được vào giữa cũng đọc và sửa được dữ liệu bill của nhóm. Nếu chính sách không cho lấy file CA, cách sạch hơn là nhờ IT đưa tên miền gateway vào danh sách miễn quét.

Hai mã lỗi họ hàng cần phân biệt: `DEPTH_ZERO_SELF_SIGNED_CERT` là chính máy chủ tự ký chứng chỉ cho nó — bình thường với gateway nội bộ, chữa cũng bằng `NODE_EXTRA_CA_CERTS`. Còn `CERT_HAS_EXPIRED` trên một dịch vụ công khai thì hãy nghi đồng hồ máy chạy app bị lệch ngày trước khi nghi chứng chỉ.

Khi gateway trả lỗi, app ghép nội dung lỗi của nó vào thông báo để bạn đọc được nguyên nhân — nhưng lọc bí mật trước. Một số gateway vọng lại toàn bộ request header trong body 401, và nếu không lọc thì chính API key sẽ hiện trên trình duyệt. Nên chỗ nào đáng ra là key sẽ thấy `…(đã che)`.

## Sao lưu

Tab Cài đặt có hai nút tải về: CSV bill (mỗi dòng là phần của một người trong một bill, dễ pivot trong Excel) và CSV các khoản đã trả nhau. CSV có BOM nên Excel tiếng Việt mở đúng dấu. Đây là bản tải để xem/lưu trữ — app không hỗ trợ nhập ngược file này trở lại (không có tính năng import), tránh rủi ro dữ liệu trùng hoặc sai lệch do sửa file thủ công.

### Backup DB lên GitHub

Không cần Google Drive hay service account — chỉ cần một Personal Access Token của GitHub, dùng được cả với tài khoản Gmail cá nhân.

Vào github.com/settings/tokens, tạo token (classic: tick quyền `repo` — chú ý phải là `repo` đầy đủ, không phải `public_repo`, nếu repo đích là riêng tư `public_repo` sẽ không vào được; fine-grained: ở "Repository access" chọn đúng repo đích hoặc "All repositories", rồi cấp quyền Contents → Read and write). Chọn hoặc tạo một repo để chứa bản backup, có thể là repo riêng tư. Điền vào `.env`:

```
GITHUB_BACKUP_TOKEN=ghp_...
GITHUB_BACKUP_REPO=ten-tai-khoan/ten-repo
```

App tự tạo một nhánh riêng tên `backup-data` (dựa trên nhánh `main` hoặc `master` hiện có của repo) để chứa file backup, không đụng tới code trên nhánh chính. Nếu repo đích hoàn toàn trống (chưa có commit nào) thì GitHub chưa có nhánh mặc định để app dựa vào — hãy tạo ít nhất một commit (ví dụ một README) trong repo trước khi dùng.

Với repo riêng tư, GitHub trả lời như thể repo không tồn tại (404) nếu token không đủ quyền, y hệt trường hợp gõ sai tên repo — nên nếu báo lỗi "không truy cập được repo" thì việc đầu tiên cần kiểm tra là quyền của token, không phải tên repo.

Backup không có nút bấm trong giao diện — nó chạy hoàn toàn tự động theo lịch, xem mục dưới. Chỉ sao lưu file `.db`, không sao lưu CSV: CSV chỉ để người dùng tải về xem, còn khôi phục sau khi build lại thì cần đúng file DB.

Bản sao lưu được lấy bằng SQLite backup API (`snapshotDb` trong `src/lib/db.ts`) chứ không đọc thô file `.db`. Lý do quan trọng: DB chạy chế độ WAL nên dữ liệu mới nằm trong file `-wal` cho tới khi checkpoint, và `wal_checkpoint(TRUNCATE)` sẽ âm thầm bỏ qua khi còn kết nối khác đang đọc — đọc thô lúc đó cho ra file gần như rỗng. App còn mở lại bản snapshot kiểm tra có bảng `bills` trước khi đẩy lên, để không bao giờ lưu một bản backup rỗng.

### Đặt lịch tự động: `BACKUP_CRON`

Lịch backup khai bằng một biến trong `.env`, không cần crontab của máy:

```
BACKUP_CRON=0 23 * * *
```

Năm trường theo thứ tự `phút giờ ngày-trong-tháng tháng thứ`, tính theo giờ địa phương của máy chạy app. `0 23 * * *` là 23:00 mỗi ngày; `30 2 * * 1` là 02:30 mỗi thứ Hai (0 là Chủ nhật); `0 */6 * * *` là mỗi 6 tiếng. Để trống biến này thì backup tự động tắt.

Lịch gõ sai cú pháp sẽ khiến app in lỗi ra terminal và **không** chạy backup, thay vì âm thầm chạy sai. Đây là lựa chọn có chủ ý: với một tính năng backup thì lịch sai mà vẫn im lặng là kiểu lỗi tệ nhất — mọi thứ trông bình thường cho tới hôm cần khôi phục mới biết chẳng có bản nào. Khi lịch hợp lệ, lúc khởi động app in ra dòng như `[poco-biller] Backup DB tự động: 23:00 mỗi ngày.` — nếu không thấy dòng này thì scheduler chưa chạy.

Cơ chế hẹn giờ nằm trong tiến trình app: `getDb()` trong `src/lib/db.ts` gọi `startBackupScheduler` lần đầu có request đụng tới DB. Nên nó cần một tiến trình sống lâu: `npm start`, pm2, Docker, systemd. Trên Vercel serverless thì vô dụng vì tiến trình không sống qua các lần gọi — ở đó dùng Vercel Cron trỏ tới `/api/cron/backup`.

Chỗ này trông hơi lạ nên ghi lại lý do: cách đúng sách là dùng hook `register()` của `src/instrumentation.ts`, nhưng Next biên dịch file đó cho cả edge runtime và webpack trace **cả** `await import()`, nên mọi đường dẫn từ instrumentation tới `db.ts` đều kéo `better-sqlite3` vào bundle edge và vỡ với `Module not found: Can't resolve 'fs'`. Guard `NEXT_RUNTIME` không cứu được vì nó chỉ tác động lúc chạy, còn lỗi xảy ra lúc build. Gắn vào `getDb()` là chắc chắn vì đó là điểm vào duy nhất của DB và chỉ tồn tại ở Node runtime.

**`CRON_SECRET` là mật khẩu bảo vệ endpoint, không phải lịch chạy.** Nó chỉ cần khi muốn gọi backup từ bên ngoài (Vercel Cron, hoặc gọi tay để thử). Sinh một chuỗi ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Rồi khai vào `.env` và gọi:

```bash
curl -fsS -H "x-cron-secret: CHUOI_NGAU_NHIEN_VUA_SINH" http://localhost:3000/api/cron/backup
```

Endpoint trả 401 nếu sai mã và 503 nếu chưa đặt `CRON_SECRET` hoặc chưa cấu hình GitHub, nên để trống là tính năng tự tắt. Đã có `BACKUP_CRON` thì không cần `CRON_SECRET`.

Muốn thử ngay không cần chờ tới giờ, gọi đúng dòng curl trên — nó trả về tên file và dung lượng, ví dụ `{"file":"poco-db-2026-08-07.sqlite","sizeKB":148}`. Nếu `sizeKB` chỉ vài KB thì DB đang thật sự rỗng, cần kiểm tra lại trước khi tin vào bản backup đó.

### Phục hồi DB khi build lại

Mỗi lần chạy `npm run build` hoặc `npm start`, script `scripts/restore-db.mjs` tự chạy trước (`prebuild`/`prestart`). Nếu file DB local (`DATABASE_PATH`) chưa tồn tại — ví dụ vừa deploy lên một máy chủ mới, ổ đĩa bị xoá, hoặc container khởi tạo lại từ đầu — script sẽ tự tìm bản `poco-db-*.sqlite` mới nhất trên nhánh `backup-data` của repo GitHub và tải về đúng vị trí đó. Nếu DB đã có sẵn thì script bỏ qua, không ghi đè. Cần đặt `GITHUB_BACKUP_TOKEN`/`GITHUB_BACKUP_REPO` trước khi build để bước này hoạt động.

## Kiểm tra logic tiền tệ

```bash
npm test
```

Chạy 124 kiểm tra không cần server: đọc số tiền viết tắt kiểu Việt (`150k`, `1tr2`, `1,5 triệu`, `250.000`), chia tiền luôn khớp tổng qua 100 lần thử ngẫu nhiên, tổng số dư cả nhóm luôn bằng 0, số giao dịch gợi ý không vượt số người trừ một, ghép URL endpoint AI từ cả ba dạng viết, thông báo lỗi mạng chỉ đúng nguyên nhân, phân biệt proxy cắt TLS với chứng chỉ nội bộ, đọc được phản hồi dạng stream, sinh đúng URL QR chuyển khoản, bí mật không lọt ra thông báo lỗi, và lịch `BACKUP_CRON` khớp đúng thời điểm — kể cả luật ngày/thứ của cron, chỗ mà một lịch hằng tuần rất dễ âm thầm biến thành hằng ngày.

## Cấu trúc

```
src/lib/          money, balance, period, queries, auth, backup, github-backup,
                  claude, qr, db, cron-expr, scheduler
src/app/api/      route handler cho auth, groups, bills, settlements, ai, cron
src/app/          4 trang: sổ bill, thêm bill, nhắc nợ, cài đặt
src/components/   BillForm, BillSheet, TabBar, CopyButton, CopyImageButton, Icons
scripts/          test-logic.mjs, restore-db.mjs
data/poco.db      SQLite, tự tạo, đã có trong .gitignore
```

Tiền lưu bằng số nguyên VND, không dùng số thực, nên không bao giờ có sai số làm tròn. Mật khẩu băm bcrypt, phiên đăng nhập là token ngẫu nhiên trong cookie HttpOnly hạn 30 ngày.

## Triển khai

Vì dùng SQLite ghi ra file, app cần một ổ đĩa bền. Vercel serverless không giữ file giữa các lần gọi nên nếu deploy ở đó bạn phải chuyển sang Turso hoặc Postgres. Cách nhẹ nhất là chạy `npm run build && npm start` trên một VPS nhỏ, hoặc Fly.io với volume, hoặc Railway. Đặt `DATABASE_PATH` trỏ vào volume đó và nhớ đặt `NODE_ENV=production` để cookie bật cờ secure.
