# Kết quả kiểm thử ngày 25/11/2026

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

- `npm test`: 49 ca qua, dùng adapter giao dịch tách biệt.
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

- Chưa publish rules mới hoặc triển khai frontend lên hosting production. Firebase Console đang yêu cầu đăng nhập Google có quyền dự án `tietkiem-18e06`; Firebase CLI cũng chưa có phiên đăng nhập. Cần hoàn thành bước đó để test lại thu nhập, QR hủy và hoàn tác trên production.
- Chưa mở/chuyển tiền trong ứng dụng ngân hàng thật. Hỗ trợ autofill phụ thuộc ngân hàng; kết quả mở deeplink không phải kết quả thanh toán.
- Chưa kiểm tra camera vật lý, bàn phím iOS/Android hay mạng chập chờn trên điện thoại thật.
- Dữ liệu cũ thiếu liên kết khoản dự trù/ngày hạch toán có thể cần đối chiếu hoặc reset riêng. Không tự sửa số tiền đã tích lũy trước đây bằng suy đoán.
- Thư mục ban đầu không có `.git`; không có baseline Git để xuất diff lịch sử hoặc push vào repository ứng dụng. Các repo hướng dẫn đã được tải bằng Git để tham khảo, không tạo remote ứng dụng mới.
