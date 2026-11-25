# Kết quả kiểm thử ngày 25/11/2026

## Lượt sửa QR và UX mới nhất

- `npm test`: 57 ca qua. Bổ sung kiểm tra thứ tự giữ cửa sổ → lưu khoản chờ → mở ngân hàng; lưu lỗi không mở; popup bị chặn vẫn có trạng thái chờ và retry; mã app VPBank/MyVIB; route riêng VCB iOS. Hai kỳ vọng test cũ được đồng bộ với bộ tính ngân sách hiện tại (chia số dư nhỏ theo ngày còn lại và `walletLimit` là số dư thô); không sửa bộ tính tiền ở lượt này.
- Build TypeScript/Vite qua. Cảnh báo chunk Firestore vẫn còn.
- Browser QA 375×812 và 1280×900: không tràn ngang; QR tổng hợp đọc đúng người nhận MB Bank, STK, 35.000đ; chọn Vietcombank không bị ràng buộc tên ví. Tạo khoản chờ 35.000đ làm số dư QA giảm 12.385.000đ → 12.350.000đ; hủy trở về 12.385.000đ, không còn khoản chờ. Không thấy lỗi console trong luồng QA.
- Nút mở app nằm ngoài vùng cuộn ở chân bảng. Tab cuối quay lại nút đóng; Escape trả focus về nút mở. CSS reduced motion có, chưa đổi thiết lập OS. Theme sáng đã nhìn; không có dark mode.
- Đã đọc lại dữ liệu Firebase hiện tại qua local app: có ví ngân sách `vian`; chọn Vietcombank bật đúng nút mở. Không ghi thêm, reset hay khôi phục dữ liệu thật ở lượt sửa này. Đây chỉ là kiểm tra kết nối/đọc, chưa xác minh lại toàn bộ thao tác ghi với rules production mới. Có log Firebase được công cụ che nội dung, chưa thể kết luận nguyên nhân; snapshot vẫn tải và hiển thị.
- Safari/iPhone + VCB: đã đối chiếu catalog và trang handoff VietQR; VCB `autofill=0`, trang iOS công bố `vietcombankmobile://`. Đã thêm route mở trực tiếp và HTTPS dự phòng; clipboard bắt đầu ngay trong lần chạm. Chưa kiểm chứng chuyển sang VCB, clipboard và camera trên iPhone thật. Yêu cầu điều hướng trên desktop không phải bằng chứng app đã mở.
- Review độc lập Hallmark: 2 phát hiện đã sửa và xác minh trên browser: đổi ngân hàng gửi giữ nguyên ví ghi chi đã chọn; STK 34 ký tự xuống dòng, không chạm nút chép (khoảng cách 12px, không tràn ngang). Thêm ví phụ 0đ vào fixture QA để tái hiện lựa chọn nhiều ví.
- Static sweep các file thay đổi: 0 FAIL, 0 WARN, 3 WAIVED (2 spacing gốc Lucian + camera live), 2 DISMISSED có lý do (bank choices là lựa chọn ngang hàng, đoạn 30ch là caption).
- Production https://tietkiem-black.vercel.app/ đã mở được trang đăng nhập. Asset hiện tại `index-iikbLPC0.js` là bản cũ; không đăng nhập production để ghi dữ liệu.
- Không sửa dịch vụ ghi tiền hay rules; bộ emulator 13 ca là kết quả lượt trước, chưa chạy lại ở lượt này.

## Các kiểm tra ở lượt trước

Các số dư, nút khôi phục và quyền truy cập bên dưới là lịch sử tại thời điểm kiểm tra trước. Sau đó người dùng đã cập nhật ứng dụng và dữ liệu; không coi các giá trị này là hiện trạng.


## Kiểm tra logic trừ tiền

- Giữ tiền QR chỉ trừ một lần; xác nhận lặp không trừ thêm.
- Hủy/hoàn tác lặp hoàn đúng một lần; không hủy một QR đã được phiên khác xác nhận.
- Hai khoản chi đồng thời không thể làm âm số dư.
- Từ chối số tiền 0, âm, NaN, Infinity, số lẻ và số vượt giới hạn an toàn.
- Thanh toán dự trù, kể cả qua QR, không ghi hai lần; hủy/hoàn tác mở lại dự trù.
- Thu nhập cộng tiền; hoàn tác thu nhập trừ tiền thay vì cộng thêm.
- Chi phí cố định dùng khoản đã dành, không trừ thêm hạn mức ngày; phần vượt dự trù vẫn giảm tiền sinh hoạt.
- Ngày lương, tháng nhuận và ngày cuối kỳ không dùng mốc 5/30 cố định; đổi ngày lương không bỏ giao dịch đã có ngày hạch toán.

## Kiểm tra logic tiết kiệm

- Góp mục tiêu trừ ví nguồn, cộng ví tiết kiệm, cộng mục tiêu trong cùng transaction.
- Tổng số dư hai ví được bảo toàn; không tạo tiền từ thao tác góp mục tiêu.
- Không rút tiền đã gán cho mục tiêu qua thao tác chuyển ví chung.
- Hoàn tác khoản góp đảo đúng hai ví, mục tiêu và số đã phân bổ.
- Tiết kiệm trong mục tiêu tháng không bị giữ thêm lần hai; phần góp vượt mục tiêu giảm ngân sách còn lại.
- Khoản cho mượn giảm tiền khả dụng, tách khỏi tổng chi tiêu. Chưa có luồng thu hồi khoản vay được liên kết tự động.

## Kiểm thử tự động

- Ở lượt trước, `npm test`: 49 ca qua, dùng adapter giao dịch tách biệt.
- `npm run test:emulator`: 13 ca qua trên Firestore Emulator, với SDK và file rules thật, gồm chặn truy cập khác chủ ví, ví âm và chưa đăng nhập.
- Kiểm tra bundle production: không chứa tài khoản hay kho dữ liệu QA.
- `npm run build`: TypeScript và Vite build qua. Có cảnh báo kích thước chunk Firestore (~560 KB thô); QR và các màn hình phụ đã tách tải theo nhu cầu.
- Review độc lập phát hiện 4 lỗi và đã xác nhận sửa: thay ngày lương, dự trù trong QR, khớp app ngân hàng/ví nguồn, bản nháp lương bị reset theo đồng hồ.

## Kiểm tra trên browser

Dùng bản QA tách biệt tại `127.0.0.1:5174`, không ghi tài khoản thật.

- 375 × 812 và 1280 × 900: kiểm tra bố cục, không có cuộn ngang ở mobile.
- Ghi chi 35.000đ: tiền mặt và tiền có thể chi cùng giảm đúng 35.000đ.
- Góp 200.000đ: ví nguồn giảm, ví tiết kiệm và mục tiêu cùng tăng đúng số tiền.
- Tạo/hủy QR 50.000đ: hoàn về số dư ban đầu.
- QR dùng dự trù 500.000đ: giữ tiền nhưng không trừ thêm hạn mức ngày; hủy khôi phục cả dự trù và ví.
- Thêm ví Vietcombank với số dư 1.000.000đ; QR từ ví này chỉ hiện liên kết `app=vcb`, giữ và hoàn đúng ví.
- Ảnh VietQR tổng hợp: đọc đúng MB Bank, STK, người nhận QA, 35.000đ và nội dung.
- Ghi khoản vượt số dư: báo lỗi, form giữ nguyên nội dung.
- Bàn phím: Tab cuối bảng quay về nút đóng; Escape đóng bảng và trả focus về nút mở.
- Không thấy lỗi console trong các luồng đã thao tác.
- Kiểm tra fallback CSS cho reduced motion. Chưa đổi thiết lập reduced motion trên thiết bị thật; chưa có giao diện dark mode.

## Kiểm tra tài khoản thật

- Đã xác minh `hung@gmail.com`, phát hiện dữ liệu cũ có ví âm và giao dịch lặp. Sau xác nhận ngay tại thời điểm thực hiện, đã lưu bản sao trong `users/{uid}.financeTestBackup`, rồi đặt lại riêng 5 nhóm dữ liệu tài chính; giữ quyền admin, gói và quỹ chung.
- Đã thiết lập dữ liệu thử (lương 10.000.000đ, cố định 2.500.000đ, mục tiêu tháng 2.000.000đ, số dư mở VCB 10.000.000đ). Đã ghi `TEST - Chi 35k` và góp 200.000đ vào `TEST - Quỹ dự phòng` trên Firestore thật; reload xác nhận VCB 9.765.000đ, ví tiết kiệm/mục tiêu 200.000đ, tiền mặt 0đ.
- Thử thêm thu nhập 10.000đ bị từ chối do rules production cũ; ví không bị tăng và form giữ dữ liệu. Bản rules mới đã qua emulator, gồm luồng khôi phục chính xác cả số dư âm trong bản sao cũ nhưng chặn ghi âm mới.
- Nút “Khôi phục dữ liệu trước khi thử” nằm ở Tài khoản và màn hình thiết lập. Bản sao cũ chưa bị tiêu thụ. Dữ liệu hiện tại là dữ liệu thử, không phải số dư ngân hàng đã xác minh.

## Còn cần kiểm chứng thực tế

- Người dùng báo đã thay rules và đã triển khai frontend trên Vercel. Bản sửa QR/UX mới nhất hiện nằm trong workspace; cần đối chiếu deployment mới trước khi kết luận production đã có bản sửa.
- Chưa mở/chuyển tiền trong ứng dụng ngân hàng thật. Hỗ trợ autofill phụ thuộc ngân hàng; kết quả mở deeplink không phải kết quả thanh toán.
- Chưa kiểm tra camera vật lý, bàn phím iOS/Android hay mạng chập chờn trên điện thoại thật.
- Dữ liệu cũ thiếu liên kết khoản dự trù/ngày hạch toán có thể cần đối chiếu hoặc reset riêng. Không tự sửa số tiền đã tích lũy trước đây bằng suy đoán.
- Workspace hiện đã có Git, remote `bichngoc61204/tietkiem`, nhánh `main`. Lượt sửa này chưa commit hoặc push; các file build được theo dõi trong repo cũng thay đổi sau build.
