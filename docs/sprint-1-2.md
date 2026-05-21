# Sprint 1-2 - Foundation

## Goal

Build the technical foundation for the Tutor Booking Platform MVP.

## Scope

- Monorepo workspace.
- Next.js web app.
- NestJS API app.
- PostgreSQL and Redis local infrastructure.
- Prisma database schema for authentication.
- Auth flow foundation: register, login, email verification, current user.
- Basic local development documentation.

## Definition of Done

- `npm run dev:api` starts the backend API.
- `npm run dev:web` starts the web app.
- `docker compose up -d` starts PostgreSQL and Redis.
- Prisma migration exists for initial auth schema.
- User registration stores hashed passwords.
- Login returns valid auth tokens.
- Authenticated `/auth/me` returns the current user without sensitive fields.

