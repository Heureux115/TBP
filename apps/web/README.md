# TutorConnect Web

Đây là frontend của TutorConnect, được xây dựng bằng Next.js, React, TypeScript và Tailwind CSS.

Frontend gọi API backend tại:

```txt
http://localhost:3001/api/v1
```

## Cài đặt

Từ thư mục gốc của repo, cài dependencies:

```powershell
npm.cmd install
```

Tạo file môi trường cho web:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Nội dung mặc định:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

## Chạy web

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

## Lệnh thường dùng

```powershell
npm.cmd --workspace apps/web run dev      # Chạy dev server
npm.cmd --workspace apps/web run build    # Build production
npm.cmd --workspace apps/web run start    # Chạy bản production đã build
npm.cmd --workspace apps/web run lint     # Chạy ESLint
```

## Kiểm thử

Chạy E2E từ thư mục gốc repo:

```powershell
npm.cmd run test:e2e
```
