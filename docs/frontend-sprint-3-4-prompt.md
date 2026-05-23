# Frontend Prompt - Sprint 3-4 Tutor Onboarding

Use this prompt to ask another frontend developer/AI agent to build the Sprint 3-4 screens.

## Prompt

You are working on the TutorConnect / Tutor Booking Platform web app.

Tech stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Existing app path: `apps/web`
- Existing auth flow is already implemented:
  - `/`
  - `/register`
  - `/verify-email`
  - `/login`
  - `/dashboard`
- Auth tokens are stored in `localStorage` through `src/lib/auth-storage.ts`.
- API helper exists in `src/lib/api.ts`.

Build only the frontend screens for Sprint 3-4: Tutor Onboarding and Admin Tutor Review. Do not implement backend logic beyond API helper functions and typed request wrappers. Use polished, production-feeling UI consistent with the existing TutorConnect landing/auth visual system:

- Light mode
- Primary blue `#004271`
- Surface background `#f9f9ff`
- Soft borders `#c1c7d1`
- Rounded cards around `8px` to `12px`
- Dense but clear operational layout
- Vietnamese labels for user-facing onboarding/admin flows

Avoid marketing copy. These are product workflow screens.

## Pages To Build

### 1. `/tutor/onboarding`

Purpose: Tutor creates and submits verification profile.

Sections:

- Progress header:
  - Thông tin hồ sơ
  - Môn giảng dạy
  - Tài liệu xác minh
  - Kiểm tra & Gửi duyệt
- Basic tutor profile form:
  - Headline
  - Bio
  - Experience years
  - Hourly rate
  - Teaching mode: Online / Offline / Both
  - City
  - District
- Subject selection:
  - Select subject
  - Select level: Basic / Intermediate / Advanced / Exam Prep
  - Add/remove selected subject chips
- Document upload panel:
  - National ID front
  - National ID back
  - Degree
  - Certificate
  - Other optional documents
- Submit verification button.

States:

- Draft
- Missing required fields
- Uploading
- Pending review
- Rejected with reason
- Approved

UX requirements:

- Show clear checklist of required items.
- Disable submit until required profile fields, at least one subject, and required documents are present.
- After submit, show `PENDING_REVIEW` status screen.

Design direction:

- Thiết kế theo flow 4 bước dạng onboarding wizard, không phải một form dài.
- Header onboarding tối giản:
  - Logo TutorConnect
  - Nút “Lưu và Thoát” hoặc “Trợ giúp”
- Nội dung nằm trong card trung tâm, max width khoảng `768px`.
- Dùng progress bar rõ ràng ở đầu màn hình.
- Mỗi bước có nút:
  - “Quay lại”
  - “Lưu nháp”
  - “Tiếp tục”

#### Bước 1: Thông tin hồ sơ

Nội dung:

- Tiêu đề màn hình: “Hoàn thiện hồ sơ gia sư”
- Mô tả: “Cung cấp thông tin chi tiết để học viên dễ dàng tìm thấy bạn.”
- Stepper với 4 bước.
- Card “Thông tin cơ bản”.
- Upload ảnh đại diện:
  - Vùng avatar tròn
  - Icon camera
  - Gợi ý: JPG/PNG, tối đa 5MB
- Form:
  - Tiêu đề hồ sơ
  - Giới thiệu bản thân
  - Số năm kinh nghiệm
  - Giá theo giờ đề xuất
  - Hình thức dạy: Online / Offline / Cả hai
  - Tỉnh/Thành phố
  - Quận/Huyện
- Nút:
  - “Lưu nháp”
  - “Tiếp tục”

#### Bước 2: Môn giảng dạy

Nội dung:

- Tiêu đề: “Môn giảng dạy”
- Mô tả: “Chọn các môn học và trình độ bạn muốn giảng dạy. Bạn có thể thêm nhiều môn.”
- Khu vực chọn môn:
  - Search input: “Tìm kiếm môn học (VD: Toán, Tiếng Anh...)”
  - Trình độ giảng dạy:
    - Cơ bản
    - Trung cấp
    - Nâng cao
    - Luyện thi
  - Nút “Thêm môn học”
- Danh sách môn đã chọn:
  - Card môn học
  - Icon môn học
  - Tên môn
  - Các tag trình độ
  - Nút xóa
- Ví dụ card:
  - Toán học: Cơ bản, Luyện thi Đại học
  - Tiếng Anh: Giao tiếp, IELTS 6.5+

#### Bước 3: Tài liệu xác minh

Nội dung:

- Tiêu đề: “Tài liệu xác minh”
- Mô tả: “Vui lòng tải lên các tài liệu cần thiết để chúng tôi xác minh hồ sơ của bạn. Tài liệu rõ nét sẽ giúp hồ sơ được duyệt nhanh hơn.”
- Grid upload 2 cột desktop, 1 cột mobile:
  - CCCD mặt trước
  - CCCD mặt sau
  - Bằng cấp
  - Chứng chỉ, tùy chọn
- Mỗi upload card:
  - Border dashed
  - Icon tài liệu
  - Tên tài liệu
  - Text “Kéo thả file hoặc click để tải lên”
  - Link/button “Chọn file”
- Danh sách tài liệu đã tải lên:
  - Tên file
  - Loại tài liệu
  - Trạng thái “Đã tải lên”
  - Nút “Thay file”
  - Nút “Xóa”
- Ghi chú dưới cùng:
  - “Tài liệu rõ nét sẽ giúp hồ sơ được duyệt nhanh hơn”

#### Bước 4: Kiểm tra và gửi duyệt

Nội dung:

- Tiêu đề: “Kiểm tra và gửi duyệt”
- Progress bar hiển thị các bước đã hoàn thành.
- Banner thông báo:
  - “Sắp hoàn tất!”
  - “Hồ sơ của bạn sẽ được đội ngũ admin xem xét trong vòng 48 giờ sau khi gửi. Bạn sẽ nhận được email thông báo kết quả.”
- Review cards:
  - Thông tin cơ bản
  - Học vấn / bằng cấp
  - Môn học & mức giá
- Mỗi card cần có:
  - Icon
  - Tóm tắt thông tin
  - Badge “Hoàn thành”
  - Nút chỉnh sửa
- Khu vực xác nhận:
  - Checkbox: “Tôi xác nhận rằng mọi thông tin cung cấp ở trên là chính xác và trung thực...”
- Nút:
  - “Quay lại chỉnh sửa”
  - “Gửi hồ sơ duyệt”
- Nút gửi duyệt disabled cho đến khi user tick checkbox.

### 2. `/tutor/profile`

Purpose: Tutor sees their profile and verification status.

Show:

- Verification status badge:
  - Draft
  - Pending Review
  - Approved
  - Rejected
- Profile summary
- Subjects
- Documents with statuses
- Rejection reason if rejected
- CTA:
  - Continue onboarding
  - Edit profile
  - Resubmit after rejection

### 3. `/admin/tutors`

Purpose: Admin review queue.

Layout:

- Admin header
- Filters:
  - Status: Pending / Approved / Rejected / Draft
  - Search by tutor name/email
- Table/list:
  - Tutor name
  - Email
  - City/district
  - Subject count
  - Document count
  - Submitted at
  - Status
  - Review button

States:

- Loading
- Empty queue
- Error
- Pagination-ready layout, even if pagination is not wired yet

### 4. `/admin/tutors/[id]`

Purpose: Admin reviews one tutor.

Show:

- Tutor user info
- Tutor profile details
- Subjects
- Document list with preview/download links
- Verification timeline
- Approve button
- Reject button with required rejection reason modal/textarea

Behavior:

- Approve calls admin approve endpoint.
- Reject requires non-empty reason.
- After approve/reject, show success state and link back to queue.

## Expected API Contract

These endpoints may not all exist yet. Create typed functions in `src/lib/api.ts` or a new `src/lib/tutor-api.ts` matching this contract.

Tutor endpoints:

```txt
GET    /tutors/me
POST   /tutors/me
PATCH  /tutors/me
POST   /tutors/me/submit-verification
GET    /tutors/me/documents
POST   /tutors/documents/upload-url
POST   /tutors/documents
GET    /subjects
```

Admin endpoints:

```txt
GET    /admin/tutors?status=PENDING_REVIEW
GET    /admin/tutors/:id
PATCH  /admin/tutors/:id/approve
PATCH  /admin/tutors/:id/reject
```

Enums:

```ts
type TutorVerificationStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type TeachingMode = "ONLINE" | "OFFLINE" | "BOTH";
type SubjectLevel = "BASIC" | "INTERMEDIATE" | "ADVANCED" | "EXAM_PREP";
type TutorDocumentType =
  | "NATIONAL_ID_FRONT"
  | "NATIONAL_ID_BACK"
  | "DEGREE"
  | "CERTIFICATE"
  | "BACKGROUND_CHECK"
  | "OTHER";
type TutorDocumentStatus = "PENDING" | "APPROVED" | "REJECTED";
```

## Data Shape

Use these TypeScript types:

```ts
type TutorProfile = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  introVideoUrl: string | null;
  experienceYears: number | null;
  hourlyRate: string | null;
  teachingMode: TeachingMode;
  locationCity: string | null;
  locationDistrict: string | null;
  verificationStatus: TutorVerificationStatus;
  verificationSubmittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  subjects: TutorSubject[];
  documents: TutorDocument[];
};

type Subject = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isActive: boolean;
};

type TutorSubject = {
  id: string;
  subject: Subject;
  level: SubjectLevel;
};

type TutorDocument = {
  id: string;
  type: TutorDocumentType;
  status: TutorDocumentStatus;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  rejectionReason: string | null;
  reviewedAt: string | null;
};
```

## Auth Behavior

- If no access token exists, redirect to `/login`.
- Tutor screens should be reachable by `TUTOR` users.
- Admin screens should be reachable by `ADMIN` or `SUPER_ADMIN`.
- If API returns 403, show a clear access denied page.

## Deliverables

- Pages:
  - `src/app/tutor/onboarding/page.tsx`
  - `src/app/tutor/profile/page.tsx`
  - `src/app/admin/tutors/page.tsx`
  - `src/app/admin/tutors/[id]/page.tsx`
- Supporting components under:
  - `src/components/tutor/*`
  - `src/components/admin/*`
- API helpers under:
  - `src/lib/tutor-api.ts`
- Keep build and lint passing:
  - `npm.cmd --workspace apps/web run lint`
  - `npm.cmd --workspace apps/web run build`

## Important

Do not change backend files.
Do not add new UI libraries unless absolutely necessary.
Do not commit `.env` files.
Keep the screens functional with mocked fallback data if backend endpoints are not ready yet, but structure the API helpers so real endpoints can replace mock data cleanly.
