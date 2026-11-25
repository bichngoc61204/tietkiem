# Hệ thống giao diện Ví An

Ứng dụng phục vụ thao tác ghi tiền thường xuyên trên điện thoại. Giữ thương hiệu Ví An, font Be Vietnam Pro và xanh lá. Cảm giác: gần gũi, nhẹ nhàng, rõ ràng. Thêm điểm nhấn mint/đào ở hành động, thẻ tròn và phản hồi nhấn ngắn. Sổ chi tiêu là hình ảnh chủ đạo; không dùng ảnh trang trí hoặc hero quảng cáo trong màn hình làm việc.

## Thứ tự thông tin

1. Hôm nay còn có thể chi: một số chính, đã chi, hạn mức và trạng thái.
2. Quét QR ở vùng dễ bấm; ghi chi, thêm thu nhập và khoản sắp chi nằm cạnh luồng chính.
3. Tách số dư ví đã ghi nhận khỏi ngân sách và tiền tiết kiệm.
4. Thanh điều hướng điện thoại: tổng quan, lịch, QR, tiết kiệm, tài khoản. Quỹ chung nằm trong tài khoản. Ví xuất hiện trước ngân sách tháng; công cụ bán gói quản trị được thu gọn ở cuối.
5. Màn hình tiết kiệm đặt mục tiêu trước danh sách khoản sắp chi.

## Quy ước

Màu và font lấy từ token CSS. Bề mặt trung tính, nền xanh đậm dành cho số có thể chi; màu cảnh báo chỉ thể hiện trạng thái. Số tiền dùng định dạng VND và chữ số tabular. Input tối thiểu 16px, vùng bấm tối thiểu 44px, luôn có focus rõ.

Motion cho phản hồi thao tác: nhấn nút, mở bảng, trạng thái lưu và thông báo. Không dùng vòng lặp trang trí. Tôn trọng `prefers-reduced-motion`. Modal giữ focus và đóng bằng Escape; không đóng form khi ghi tiền thất bại.

QR có nguồn ngân sách (hằng ngày, cố định, khoản dự trù), ví hạch toán và ngân hàng gửi. Ví An là ngân sách trong sổ; lựa chọn ngân hàng gửi độc lập với tên ví, ưu tiên ví `vian`. Với nhiều ví cũ, người dùng chọn rõ ví ghi chi. Người nhận hiển thị trước lựa chọn ngân hàng. Nút mở app luôn ở chân bảng; trạng thái chờ và đường mở lại vẫn có khi trình duyệt chặn popup. Khóa các trường trong lúc lưu để thông tin hiển thị khớp khoản chờ đã ghi.

## Nguồn đã đọc và áp dụng

- [taste-skill](https://github.com/leonxlnx/taste-skill), commit `6c0b5c7`: phân cấp, bố cục có chủ đích, xem lại trên browser. Chỉ áp dụng nguyên tắc phù hợp với app; không đưa quy tắc trang quảng cáo vào sổ chi tiêu.
- [Hallmark](https://github.com/nutlope/hallmark), commit `04977e1`: app scope, token, trạng thái điều khiển, kiểm tra tĩnh và lượt review độc lập.
- [Unslop](https://github.com/heydamir/unslop), commit `620163e`: nhịp khoảng cách, tiết chế màu, chữ, icon và motion. Credit: Damir Sokolovsky, CC BY 4.0.
- [Lucian UX/UI #435](https://lucianlabs.dev/uxui-prompt/#435), repo commit `36f9a57`: thông báo có đường check, đếm thời gian và vuốt đóng. Chuyển sang React, tiếng Việt, một thông báo thực tại một thời điểm; bỏ nút Undo mẫu để không mô phỏng hoàn tác tiền đã lưu. Giữ thông tin bản quyền MIT trong component.

Hallmark static sweep: 0 FAIL; còn 3 REFLEX và 5 WARN đã xem xét: inset/gap gốc Lucian, camera live không cần poster, câu chú thích ngắn và nhãn nút nhiều dòng để nói rõ thao tác QR/sao lưu/khôi phục. Render của Hallmark không chạy vì thiếu Puppeteer; kiểm tra hình ảnh và thao tác dùng browser CUA tại 375px và 1280px.

- [Lucian UX/UI #042 Step-by-step wizard](https://lucianlabs.dev/uxui-prompt/#042): tiến trình QR ba bước, check hoàn tất và chuyển nội dung theo hướng tiến/lùi. Giữ đường cong và thời gian gốc, chuyển từ khung cố định sang bảng cuộn mobile; chỉ hiển thị bước đang hoạt động để tránh focus vào bước ẩn. Bước đã giữ tiền không quay lại chỉnh khoản chờ. Giao diện hiện dùng một theme sáng; reduced motion có CSS, chưa kiểm tra cài đặt thiết bị thật.

## Lượt QR/Safari mới nhất

Hallmark finish-review: subagent · 2 findings · 2 resolved, xác minh bằng browser sau sửa. Giữ ví hạch toán khi đổi ngân hàng; STK dài xuống dòng và không đè nút chép. Static sweep file thay đổi: Floor 0 FAIL · 0 WARN · 3 WAIVED · 2 DISMISSED có lý do. Nguồn Lucian 042 giữ hai khoảng cách quang học gốc; camera live chỉ chạy sau thao tác người dùng. Ba lựa chọn ngân hàng có cùng cấp chức năng; dòng chú thích ngân sách là caption ngắn.
