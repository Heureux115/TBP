# Supabase Database Setup

This project uses Supabase as the PostgreSQL database for Sprint 1-2.

## 1. Create Supabase Project

1. Open Supabase.
2. Create a new project.
3. Choose the nearest region, preferably Singapore or another Southeast Asia region.
4. Save the database password securely.

## 2. Get the Connection String

In Supabase dashboard:

1. Go to `Project Settings`.
2. Open `Database`.
3. Find `Connection string`.
4. Use the `Session pooler` connection string for this app during development.
5. Replace `[YOUR-PASSWORD]` with your real database password.

The final URL should look similar to:

```txt
postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=public
```

Do not commit the real connection string.

## 3. Configure API Environment

Create the API environment file:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Then update `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=public"
```

Also replace JWT secrets with long random values before any shared testing environment.

## 4. Generate Prisma Client

```powershell
npm.cmd --workspace apps/api run prisma:generate
```

## 5. Apply Migrations to Supabase

Use deploy for Supabase:

```powershell
npm.cmd --workspace apps/api run prisma:deploy
```

Avoid `prisma migrate dev` directly against Supabase unless a shadow database is configured. `migrate dev` is designed for local development and may require database privileges Supabase does not provide.

## 6. Open Prisma Studio

```powershell
npm.cmd --workspace apps/api run prisma:studio
```

## 7. Start the API

```powershell
npm.cmd run dev:api
```

The API will use Supabase through `DATABASE_URL`.

## 8. Configure Resend Email

Email verification uses Resend.

1. Create a Resend account.
2. Create an API key.
3. For quick development, use:

```env
EMAIL_FROM="Tutor Booking <onboarding@resend.dev>"
```

4. Add this to `apps/api/.env`:

```env
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="Tutor Booking <onboarding@resend.dev>"
```

If you use `onboarding@resend.dev`, Resend may restrict delivery to the email address used for your Resend account until a custom domain is verified.

## Notes

- Keep Supabase Row Level Security disabled for tables managed only by the NestJS API unless the frontend talks directly to Supabase.
- For this MVP, the frontend should call the NestJS API, not Supabase directly.
- Use Supabase Auth later only if the project intentionally replaces the custom NestJS auth flow. Sprint 1-2 currently implements auth in NestJS.
