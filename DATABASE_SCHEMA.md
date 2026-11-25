# Thiết kế Cơ sở dữ liệu Firestore & Kiến trúc Bán tài khoản (SaaS) — VÍ AN

## 1. Cấu trúc Collections (Multi-Tenant & Chuẩn bảo mật)

Tất cả dữ liệu cá nhân được cô lập theo `uid` của Firebase Authentication (`users/{uid}/...`), kết hợp `groups/{groupId}` cho quỹ chung nhiều thành viên và `licenseKeys/{code}` cho mô hình bán tài khoản / kích hoạt gói.

```text
users/{uid}
  ├── profile: email, displayName, role ('user' | 'admin')
  ├── subscription:
  │     ├── plan: 'free' | 'trial' | 'pro' | 'couple' | 'lifetime'
  │     ├── subscriptionStatus: 'active' | 'trial' | 'expired'
  │     ├── planExpiresAt: ISO timestamp | null (null nếu lifetime)
  │     ├── lastLicenseCode: string | null
  │     └── createdAt: ISO timestamp
  ├── financeSettings:
  │     ├── salaryConfig: { monthlyIncome, paydayDay, fixedBills, savingsTarget, totalCycleDays, todayIndex }
  │     ├── rolloverMode: 'redistribute' | 'strict'
  │     └── avoidedImpulseTotal: number
  │
  ├── accounts/{accountId}            // Nguồn tiền: MB Bank, Vietcombank, Tiền mặt, Tiết kiệm
  │     └── { name, balance, type: 'checking' | 'cash' | 'savings', updatedAt }
  │
  ├── transactions/{txId}             // Mọi dòng tiền (chi tiêu, pending QR, nội bộ, cho mượn)
  │     └── { merchant, note, category, accountId, amount, type, status, cycleDayIndex, timeLabel, createdAt }
  │
  ├── plannedExpenses/{planId}        // Chi tiêu dự kiến sắp tới (trừ trước khỏi Safe-to-Spend)
  │     └── { title, amount, category, dueDateLabel, dueDayIndex, completed }
  │
  ├── goals/{goalId}                  // Mục tiêu tiết kiệm & Quỹ dự phòng
  │     └── { title, saved, target, monthlyHint }
  │
  └── pausedItems/{itemId}            // Kho cân nhắc 24h (tránh mua bốc đồng)
        └── { name, amount, createdAt }

groups/{groupId}                      // Quỹ chung cặp đôi / bạn cùng phòng
  └── { name, typeLabel, ownerUid, memberUids: string[], monthlyBudget, sharedGoal, expenses[], activities[] }

licenseKeys/{code}                    // Kho mã bản quyền để bán tài khoản / nâng cấp gói
  └── { code, plan, durationDays, active, usedBy, usedAt, createdBy, note }
```

---

## 2. Luồng tiền hiện tại

Mọi thao tác làm thay đổi số dư dùng `runTransaction`: đọc trạng thái mới nhất, kiểm tra số dư rồi ghi đồng thời ví và giao dịch. Không cập nhật thành công trên giao diện trước khi Firestore commit. Snapshot là nguồn dữ liệu hiển thị.

- QR: ở bước 2 chọn ngân hàng gửi và ví ghi chi (ưu tiên ngân sách `vian`), nút mở app tạo `pending` và giữ tiền trong sổ trước khi điều hướng. Ngân hàng gửi độc lập với ngân sách hạch toán. Bước 3 giữ liên kết mở lại và xác nhận/hủy. Web không tự chuyển tiền hay nhận kết quả từ ngân hàng.
- Xác nhận QR chỉ đổi trạng thái; không trừ lần hai. Hủy chỉ áp dụng với giao dịch đang `pending`, hoàn tiền một lần.
- Giao dịch hủy/hoàn tác giữ bản ghi `cancelled`/`deleted` để chống hoàn tiền lặp; danh sách thông thường lọc hai trạng thái này.
- `income` cộng ví; hoàn tác thu nhập trừ ví và không cho số dư âm.
- `internal` có `destinationAccountId`. Chuyển ví và góp mục tiêu bảo toàn tổng số tiền; hoàn tác đảo cả hai ví. Góp mục tiêu cập nhật `goal.saved` và `users/{uid}.allocatedSavings` trong cùng transaction.
- Tiền đã phân bổ cho mục tiêu không được rút qua chuyển ví chung. Hoàn tác khoản góp qua lịch giao dịch để đảo đúng ví và mục tiêu.
- `plannedExpenseId` nối giao dịch với khoản dự trù. Thanh toán từ QR hoặc nút “Đã chi” chỉ tiêu thụ khoản dự trù một lần. Hủy/hoàn tác mở lại khoản này.
- `budgetSource: 'fixed'` dùng cho chi phí cố định đã dành trong cấu hình tháng; phần vượt dự trù mới làm giảm ngân sách sinh hoạt.
- `cycleStartDate` và `effectiveDate` (`YYYY-MM-DD`) giữ ngày hạch toán. Bộ tính phân loại lại ngày theo kỳ hiện hành khi đổi ngày lương, thay vì bỏ mất giao dịch có khóa kỳ cũ.
- Kỳ lương tính theo lịch thật, gồm tháng 28/29/30/31 ngày. Không tự tạo giao dịch chi hay tự cộng tiết kiệm cho ngày chưa ghi.
- “Có thể chi hôm nay” bị giới hạn bởi số dư ví chi tiêu đã trừ phần còn dành cho cố định, tiết kiệm và khoản dự kiến. Đây là số liệu người dùng ghi trong sổ, không phải số dư đọc trực tiếp từ ngân hàng.

Trường giao dịch mới: `effectiveDate?`, `cycleStartDate?`, `destinationAccountId?`, `goalId?`, `plannedExpenseId?`, `savingsDirection?`, `budgetSource?`. Trạng thái gồm `pending`, `confirmed`, `cancelled`, `deleted`; loại gồm `expense`, `loan`, `internal`, `income`.

Dữ liệu cũ chưa có ngày hạch toán hoặc liên kết khoản dự trù có thể không đủ thông tin để khôi phục cách phân bổ ban đầu. Cần đối chiếu hoặc reset riêng tài khoản thử; không tự coi các mục tiêu cũ là tiền đã thực chuyển.

---

Bản sao dữ liệu thử của tài khoản được chỉ định nằm ở `users/{uid}.financeTestBackup`, chứa cấu hình và các bản ghi gốc. Có nút khôi phục trong ứng dụng. Rules chỉ cho khôi phục số dư âm cũ nếu dữ liệu tài khoản khớp chính xác bản sao và bản sao được tiêu thụ trong cùng thao tác nguyên tử; ghi số dư âm mới vẫn bị từ chối.

## 3. Hai mô hình bán tài khoản để bạn kinh doanh

### Cách A — Bán qua Mã kích hoạt (License Key) *(Khuyên dùng, không cần Backend server)*
1. Trong giao diện Admin (tài khoản `hung@gmail.com` có sẵn quyền `admin`), bạn bấm **Tạo mã kích hoạt** (ví dụ `VIAN-PRO-8392`, gói `pro` 365 ngày hoặc `lifetime`).
2. Khách hàng chuyển khoản cho bạn → bạn gửi mã cho khách (hoặc gửi tài khoản đã kích hoạt).
3. Khách đăng nhập bằng Email trên web → nhập mã vào ô **"Kích hoạt gói bản quyền"**.
4. `firestore.rules` kiểm tra nguyên tử (`get` + `getAfter` trong cùng `writeBatch`): mã phải còn trống (`usedBy == null`), hợp lệ (`active == true`), tự động gán `usedBy = uid` và nâng `plan` của khách lên `pro` / `couple` / `lifetime` mà **khách không thể tự sửa DB để gian lận gói**.

### Cách B — Tạo sẵn tài khoản giao khách (Account Provisioning)
- Bạn tạo tài khoản cho khách qua Firebase Console / Admin SDK hoặc đăng ký hộ, sau đó gán `plan: 'pro'` trong Firestore (`users/{uid}`) vì `firestore.rules` cho phép tài khoản `admin` toàn quyền cập nhật gói & thời hạn cho khách hàng.

---

## 4. Hướng dẫn kích hoạt `firestore.rules` lên dự án `tietkiem-18e06`

1. Mở [Firebase Console](https://console.firebase.google.com/project/tietkiem-18e06/firestore/rules).
2. Copy toàn bộ nội dung file `firestore.rules` ở thư mục gốc dự án dán vào tab **Rules**.
3. Nhấn **Publish**.
