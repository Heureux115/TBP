# TutorConnect - Nền tảng đặt lịch gia sư

TutorConnect là nền tảng web kết nối học sinh, phụ huynh và gia sư. Dự án hỗ trợ các luồng chính của một marketplace gia sư: tìm kiếm gia sư, xem hồ sơ, đặt lịch học, thanh toán, nhắn tin, đánh giá và quản trị vận hành.

Repo được tổ chức theo mô hình monorepo:

```txt
.
├── apps
│   ├── web        # Frontend Next.js
│   └── api        # Backend NestJS
├── packages
│   └── shared     # Mã dùng chung
├── tests
│   └── e2e        # Kiểm thử end-to-end bằng Playwright
└── docker-compose.yml
```

## Công nghệ chính

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript, Prisma
- Database: PostgreSQL
- Cache/phụ trợ: Redis
- Kiểm thử E2E: Playwright
- Quản lý workspace: npm workspaces

## Yêu cầu

- Node.js 24+
- npm 11+
- PostgreSQL hoặc Supabase Postgres
- Docker Desktop nếu muốn chạy PostgreSQL/Redis local

Trên Windows PowerShell, nếu lệnh `npm` bị chặn bởi execution policy, dùng `npm.cmd`.

## Cài đặt

Cài dependencies:

```powershell
npm.cmd install
```

Tạo file môi trường cho API:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Cập nhật `apps/api/.env`, tối thiểu cần các biến:

```env
PORT=3001
WEB_ORIGIN="http://localhost:3000"
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="change-me-access-secret"
JWT_REFRESH_SECRET="change-me-refresh-secret"
RESEND_API_KEY="re_xxxxxxxxx"
EMAIL_FROM="TutorConnect <no-reply@example.com>"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-long-random-password"
```

Tạo file môi trường cho web:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Giá trị mặc định:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

## Chạy database local

Nếu không dùng Supabase, có thể chạy PostgreSQL và Redis bằng Docker:

```powershell
docker compose up -d
```

Khi dùng database local, đặt `DATABASE_URL` trong `apps/api/.env`:

```env
DATABASE_URL="postgresql://tutor_user:tutor_password@localhost:5432/tutor_booking?schema=public"
```

Generate Prisma client:

```powershell
npm.cmd --workspace apps/api run prisma:generate
```

Chạy migrations:

```powershell
npm.cmd --workspace apps/api run prisma:deploy
```

Seed dữ liệu mẫu nếu cần:

```powershell
npm.cmd run seed:e2e
```

## Chạy dự án

Mở 2 terminal riêng.

Terminal 1, chạy API:

```powershell
npm.cmd run dev:api
```

Terminal 2, chạy web:

```powershell
npm.cmd run dev:web
```

Sau khi chạy thành công:

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1

## Lệnh thường dùng

```powershell
npm.cmd run dev:web      # Chạy frontend
npm.cmd run dev:api      # Chạy backend
npm.cmd run build        # Build toàn bộ workspaces
npm.cmd run lint         # Chạy lint
npm.cmd run test         # Chạy unit tests
npm.cmd run test:e2e     # Chạy E2E tests
```

Mở Prisma Studio:

```powershell
npm.cmd --workspace apps/api run prisma:studio
```

## Kiểm thử

Chạy unit tests:

```powershell
npm.cmd run test
```

Chạy end-to-end tests:

```powershell
npm.cmd run test:e2e
```

Playwright sẽ tự khởi động web và API nếu chưa có server đang chạy.

## Tài liệu thêm

- [docs/supabase-setup.md](docs/supabase-setup.md): hướng dẫn cấu hình Supabase.
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md): bối cảnh sản phẩm và kiến trúc.
- [PRODUCT.md](PRODUCT.md): định hướng sản phẩm.
