# Ví An

Web mobile quản lý chi tiêu cá nhân: đọc VietQR, mở đúng app ngân hàng của ví nguồn, xác nhận khoản chi và dành tiền cho mục tiêu tiết kiệm.

## Chạy ứng dụng

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Dữ liệu `hung@gmail.com` hiện là dữ liệu thử; bản sao trước khi làm sạch có nút khôi phục tại Tài khoản.

Bản này dùng Firebase được cấu hình trong `src/lib/firebase.ts` và yêu cầu đăng nhập. Chưa tự triển khai production. Khi cập nhật backend, publish `firestore.rules` mới cùng phiên bản frontend vì có thêm loại `income` và trạng thái `cancelled`/`deleted`.

## Xem thử bằng dữ liệu giả

```sh
npm run qa
```

Mở http://127.0.0.1:5174/. Chế độ QA thay SDK bằng bộ nhớ tách biệt, hiển thị banner rõ ràng và reset khi tải lại trang. Không đăng nhập, sửa hoặc xóa dữ liệu Firebase thật. Vite từ chối build chế độ QA để tránh xuất nhầm bản giả làm production.

## Kiểm thử

```sh
npm test
npm run build
```

`npm test` chạy 49 ca cho bộ tính ngân sách và dịch vụ ghi tiền qua adapter có retry giao dịch. Bộ test không thay thế kiểm thử rules.

Kiểm thử Firestore Emulator riêng:

```sh
# Cần Java 21+; có thể cài công cụ kiểm thử trong thư mục tạm.
npm install --prefix /tmp/vian-emulator firebase-tools @firebase/rules-unit-testing firebase
/tmp/vian-emulator/node_modules/.bin/firebase emulators:start --only firestore --project demo-vian-tests --config firebase.test.json
# Chạy tại một terminal khác, trong thư mục dự án:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8088 VIAN_EMULATOR_TOOLS=/tmp/vian-emulator npm run test:emulator
```

Bộ integration gồm 13 ca, dùng SDK và rules thật trên dự án demo. Script từ chối chạy khi không có địa chỉ emulator loopback. Các dòng `PERMISSION_DENIED` trong ca kiểm tra truy cập trái phép là kết quả mong đợi.

## Cấu trúc

- `src/App.tsx`: xác thực, điều hướng, đồng bộ snapshot, điều phối thao tác ghi.
- `src/services/firestoreService.ts`: giao dịch nguyên tử, giữ/hoàn tiền QR, khoản dự trù, chuyển ví, mục tiêu.
- `src/utils/budgetEngine.ts`, `cycle.ts`: ngân sách và lịch kỳ lương thật.
- `src/utils/vietqr.ts`: kiểm tra CRC, đọc payload VietQR và tạo liên kết mở ngân hàng.
- `src/components/`: màn hình, bảng QR, form, lịch và mục tiêu.
- `src/hooks/useModal.ts`: khóa cuộn, giữ focus, Escape và trả focus khi đóng.
- `src/index.css`, `tokens.css`: hệ thống giao diện; `components/toast.css`: motion thông báo.
- `tests/`: adapter QA, kiểm thử logic và kiểm thử emulator.
- `DATABASE_SCHEMA.md`: mô hình lưu trữ và quy tắc dòng tiền.
- `QA_REPORT.md`: kết quả đã kiểm tra và các phần cần kiểm chứng trên thiết bị/tài khoản thật.

Ví An ghi số liệu trong sổ, không truy cập số dư ngân hàng và không tự chuyển tiền. Việc mở app không phải bằng chứng thanh toán; người dùng xác nhận khi quay lại.
