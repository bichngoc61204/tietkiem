# Deploy Ví An lên Vercel

## ✅ Trước khi deploy

Firebase config đã hardcode trong `src/lib/firebase.ts` → **không cần tạo biến môi trường** gì thêm.

---

## 🚀 Các bước deploy (5 phút)

### Bước 1 — Push code lên GitHub
```bash
cd /Users/mac/Documents/ChatGPT/tietkiem

git init                        # (nếu chưa có git)
git add .
git commit -m "deploy: Vi An ready"
git branch -M main
git remote add origin https://github.com/TÊN_BẠN/vi-an.git
git push -u origin main
```
> Nếu chưa có repo GitHub: vào https://github.com/new → tạo repo mới → copy lệnh remote ở đó.

---

### Bước 2 — Tạo project trên Vercel
1. Mở https://vercel.com → **Sign in với GitHub**
2. Nhấn **Add New → Project**
3. Chọn repo **vi-an** vừa push
4. Vercel tự nhận ra **Vite** → cấu hình tự động:

| Setting | Giá trị |
|---------|--------|
| Framework | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

5. Nhấn **Deploy** → chờ ~1–2 phút

---

### Bước 3 — Thêm vercel.json (SPA routing)
Tạo file `vercel.json` tại root project:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Commit và push lại:
```bash
git add vercel.json
git commit -m "fix: SPA routing vercel"
git push
```
Vercel sẽ tự redeploy.

---

### Bước 4 — Kiểm tra
- Mở URL dạng `https://vi-an-xxx.vercel.app`
- Đăng nhập → xác nhận ví, giao dịch, gợi ý ăn uống hoạt động bình thường

---

## 🔄 Cập nhật sau này
Mỗi lần sửa code, chỉ cần:
```bash
git add .
git commit -m "update: mô tả thay đổi"
git push
```
Vercel tự redeploy, không cần làm gì thêm.

---

## 🧹 Xóa dữ liệu thử nghiệm
Chạy lệnh sau (sau khi đã đăng nhập trong trình duyệt):
```bash
npx ts-node src/scripts/clearTestData.ts
```
Hoặc nhấn nút **"Xóa dữ liệu test"** trong tab **Tài khoản** (nếu còn hiển thị).
