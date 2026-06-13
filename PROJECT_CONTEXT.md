# Project Context - Tutor Booking Platform

## 1. Product Overview

Tutor Booking Platform la nen tang ket noi hoc sinh, sinh vien va phu huynh voi gia su da duoc xac minh. He thong ho tro toan bo vong doi mot buoi hoc: tim kiem gia su, xem ho so, dat lich, thanh toan, hoc, danh gia va quan ly van hanh.

Ten san pham trong SRS: Tutor Booking Platform (TBP)  
Thi truong muc tieu ban dau: Viet Nam, tap trung Ha Noi va TP.HCM  
Nguoi dung chinh: Student, Parent, Tutor, Admin

## 2. Product Direction

Muc tieu cua MVP la xay dung mot marketplace gia su dang tin cay, co the van hanh end-to-end voi cac gia tri cot loi:

- Gia su co ho so ro rang va duoc admin xac minh.
- Hoc vien/phu huynh co the tim, loc, so sanh va dat lich nhanh.
- Thanh toan minh bach qua gateway noi dia va co escrow de giam tranh chap.
- Sau buoi hoc co review/rating de tao social proof.
- Admin co cong cu duyet ho so, quan ly nguoi dung va xu ly van hanh co ban.

Khong bien MVP thanh LMS day du, video learning platform hay AI platform. Cac tinh nang video call tich hop, AI recommendation, recurring booking, learning progress report va B2B nen de Phase 2/3.

## 3. Core Personas

- Student: tim gia su theo mon hoc, gia, lich hoc va chat luong.
- Parent: uu tien uy tin, xac minh, an toan, thanh toan ro rang va theo doi lich hoc cua con.
- Student Tutor: can tao profile, quan ly lich ranh, nhan booking va rut tien.
- Professional Tutor: can mo rong hoc vien, quan ly lich day, nhan thanh toan tu dong va xay dung thuong hieu ca nhan.
- Admin: duyet ho so gia su, quan ly user, theo doi giao dich, xu ly tranh chap va bao cao KPI.

## 4. MVP Scope

### Must Have

- User registration, login, email verification.
- Google/Facebook OAuth login.
- Tutor registration and verification workflow.
- Tutor profile creation and editing.
- Document upload for CCCD, bang cap, chung chi.
- Admin tutor approval queue.
- Tutor search by keyword and filters.
- Tutor listing and tutor detail page.
- Availability calendar for tutors.
- Booking creation with online/offline mode.
- VNPay and MoMo payment integration.
- Escrow hold and auto-release after successful session.
- Booking cancellation with refund policy.
- In-app realtime chat.
- Review and rating after completed booking.
- Email notifications.
- Push notifications for mobile app.
- Student dashboard.
- Tutor dashboard with basic earnings.
- Admin user management.
- Wallet and withdrawal for tutors.

### Out of Scope for MVP

- Built-in video call.
- AI tutor recommendation.
- Recurring booking.
- Full LMS and learning progress reports.
- International payment.
- Advanced analytics.
- Subscription plans and promoted listings.
- B2B/school integrations.

## 5. Suggested Technology Stack

Follow the SRS unless there is a strong reason to change.

- Frontend Web: Next.js 14, React, App Router.
- Mobile App: React Native with Expo.
- Backend API: NestJS 10, TypeScript.
- Database: PostgreSQL 16.
- Cache/session: Redis.
- Realtime: Socket.io.
- Storage: S3-compatible object storage for documents, avatars and videos.
- Infrastructure target: AWS ECS Fargate, RDS PostgreSQL, S3, CloudFront, ALB.
- CI/CD: GitHub Actions.

## 6. Architecture Direction

Use a modular monolith for MVP. Keep domain modules clean so they can be split later if scale requires it.

Recommended backend modules:

- AuthModule: registration, login, OAuth, JWT, refresh token, guards.
- UsersModule: user profile, roles, status.
- TutorModule: tutor profile, subjects, certificates, verification, availability.
- BookingModule: booking lifecycle, scheduling rules, cancellation.
- PaymentModule: VNPay, MoMo, escrow, wallet, withdrawal.
- ChatModule: conversations, messages, Socket.io events.
- ReviewModule: rating and comments.
- NotificationModule: email, push, in-app notifications.
- AdminModule: tutor approval, user management, operational views.

Frontend should be organized around user workflows, not only technical components:

- Auth flow.
- Student/parent discovery flow.
- Tutor onboarding flow.
- Booking and payment flow.
- Chat/review flow.
- Dashboards.
- Admin operations.

## 7. Key Data Model

Core tables from SRS:

- users
- tutor_profiles
- bookings
- payments
- reviews
- messages
- wallet_transactions

Additional expected tables during implementation:

- refresh_tokens or sessions
- tutor_subjects
- subjects
- certificates
- availability_slots
- conversations
- notifications
- booking_history
- admin_audit_logs

Database principles:

- Use UUID v4 primary keys.
- Use TIMESTAMPTZ for all timestamps.
- Use created_at and updated_at on every table.
- Prefer soft delete with deleted_at for business entities.
- Index foreign keys and common query fields.
- Use JSONB only for flexible metadata, not core relational data.

## 8. Security Requirements

- Hash passwords with bcrypt, cost factor 12.
- Use short-lived JWT access tokens, around 15 minutes.
- Store refresh tokens securely, preferably HTTP-only cookie plus server-side hash in Redis or DB.
- Enforce RBAC for STUDENT, TUTOR, ADMIN and SUPER_ADMIN.
- Do not expose unverified tutors in public search.
- Validate all inputs on backend DTOs.
- Never build SQL through string concatenation.
- Validate file upload by MIME and magic bytes, not extension only.
- Encrypt sensitive documents at rest.
- Log authentication events, admin actions and payment events.
- Use strict CORS, CSP and security headers in production.

## 9. Performance Targets

- API P50 under 200ms.
- API P95 under 500ms.
- API P99 under 1000ms.
- Tutor search results should return under 2 seconds.
- Cache public tutor search/detail responses in Redis where appropriate.
- Avoid double-booking with transaction-level safeguards.

## 10. Delivery Plan

### Sprint 1-2: Foundation

Duration: 4 weeks  
Focus: Backend + DevOps

- Project setup.
- CI/CD.
- Docker/local environment.
- Database schema.
- Auth module: register, login, email verification.

### Sprint 3-4: Tutor Onboarding

Duration: 4 weeks  
Focus: Backend + Frontend

- Tutor profile.
- Document upload.
- S3 integration.
- Admin review queue.
- Tutor approval/rejection flow.

### Sprint 5-6: Discovery

Duration: 4 weeks  
Focus: Frontend heavy

- Search module.
- Tutor listing page.
- Tutor detail page.
- Filters and sorting.
- Availability calendar.

### Sprint 7-8: Booking and Payment

Duration: 4 weeks  
Focus: Backend heavy

- Booking creation.
- Online/offline mode.
- VNPay and MoMo payment integration.
- Escrow logic.
- Cancellation and refund policy.

### Sprint 9-10: Engagement

Duration: 4 weeks  
Focus: Full-stack

- Chat module with Socket.io.
- Review system.
- Email notifications.
- Push/in-app notifications.

### Sprint 11-12: Dashboards and Web QA

Duration: 4 weeks  
Focus: Full-stack + QA

- Student dashboard.
- Tutor dashboard with basic earnings.
- Admin user management.
- Web responsive role workflows.
- Bug fixing and regression testing.

Note: React Native mobile app is deferred. The current MVP scope is web-only across student, tutor, and admin roles.

### Sprint 13: Launch Readiness

Duration: 2 weeks  
Focus: All teams

- Beta testing.
- Performance tuning.
- Security audit.
- Soft launch.

## 11. Implementation Principles

- Build the actual booking marketplace first, not a marketing landing page.
- Keep the MVP small enough to ship but complete enough to validate the marketplace loop.
- Treat trust and safety as core product functionality, not an admin afterthought.
- Prioritize correctness in booking/payment flows over UI polish.
- Every payment state change must be auditable.
- Every booking status transition should be explicit and validated.
- Prefer simple, traceable business logic before introducing automation or AI.
- Keep AI features behind a future roadmap until there is enough usage data.

## 12. Important Business Rules

- A tutor must be verified before appearing in search results.
- Email must be unique.
- Phone number should be unique if collected.
- Tutor must be at least 18 years old.
- A booking slot cannot be double-booked.
- A user can only review a completed booking they participated in.
- A booking can only be cancelled according to the cancellation policy.
- Escrow money should only be released after session completion or after the defined auto-release window.
- Admin actions should be logged.

## 13. API Direction

Base API style: RESTful JSON API.

Expected endpoint groups:

- /auth/register
- /auth/login
- /auth/refresh
- /tutors/search
- /tutors/:id
- /tutors/:id/availability
- /bookings
- /bookings/:id/cancel
- /payments/initiate
- /payments/webhook/vnpay
- /payments/webhook/momo
- /reviews
- /notifications
- /admin/tutors/review
- /admin/users

Use consistent error format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": []
}
```

## 14. Product Guardrails

When making future decisions, prefer the option that improves:

- Trust between parent/student and tutor.
- Booking completion rate.
- Payment transparency.
- Tutor supply quality.
- Operational visibility for admin.
- Simplicity of the MVP delivery path.

Avoid decisions that add large scope before the core marketplace loop is stable.
