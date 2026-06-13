# TutorConnect Web

Đây là frontend của TutorConnect, được xây dựng bằng Next.js, React, TypeScript và Tailwind CSS.

Frontend gọi API backend mặc định tại:

```txt
http://localhost:3001/api/v1
```

## Cài Đặt

Từ thư mục gốc của repo, cài dependencies:

```powershell
npm.cmd install
```

Nếu cần cấu hình riêng cho web, tạo file môi trường:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Nội dung thường dùng:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

## Chạy Web

Chạy backend trước:

```powershell
npm.cmd run dev:api
```

Sau đó chạy frontend:

```powershell
npm.cmd run dev:web
```

Hoặc chạy trực tiếp workspace web:

```powershell
npm.cmd --workspace apps/web run dev
```

Mở trình duyệt tại:

```txt
http://localhost:3000
```

## Lệnh Thường Dùng

```powershell
npm.cmd --workspace apps/web run dev
npm.cmd --workspace apps/web run build
npm.cmd --workspace apps/web run start
npm.cmd --workspace apps/web run lint
```

## Kiểm Thử

Chạy E2E từ thư mục gốc repo:

```powershell
npm.cmd run test:e2e
```
