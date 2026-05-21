# Tutor Booking Platform

Monorepo for the Tutor Booking Platform MVP.

## Apps

- `apps/api`: NestJS backend API.
- `apps/web`: Next.js web frontend.
- `packages/shared`: shared constants and types.

## Prerequisites

- Node.js 24+
- npm 11+
- Supabase project for PostgreSQL
- Docker Desktop only if using local PostgreSQL/Redis instead of Supabase

Use `npm.cmd` on Windows PowerShell if direct `npm` is blocked by execution policy.

## Local Setup

Install dependencies:

```powershell
npm.cmd install
```

Create API environment file:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Update `apps/api/.env` with your Supabase Postgres `DATABASE_URL`.
See `docs/supabase-setup.md`.

Also set Resend email variables in `apps/api/.env`:

```env
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="Tutor Booking <onboarding@resend.dev>"
```

Create web environment file:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Generate Prisma client:

```powershell
npm.cmd --workspace apps/api run prisma:generate
```

Run initial migration:

```powershell
npm.cmd --workspace apps/api run prisma:deploy
```

Start API:

```powershell
npm.cmd run dev:api
```

Start web:

```powershell
npm.cmd run dev:web
```

Open:

```txt
http://localhost:3000
```

The API runs at:

```txt
http://localhost:3001/api/v1
```

## Sprint 1-2 Focus

- Project setup.
- CI/CD foundation.
- Database schema.
- Authentication: register, login, email verification.

## Optional Local Database

If you do not want to use Supabase, local PostgreSQL and Redis can be started with:

```powershell
docker compose up -d
```

Then set `DATABASE_URL` to the local PostgreSQL URL from `docker-compose.yml`.
