import Image from "next/image";
import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";
import { Card, Icon, StatusBadge } from "@/components/ui";

const heroImage = "/landding.png";

const trustSignals = [
  { icon: "verified_user", label: "Hồ sơ gia sư có trạng thái xác minh" },
  { icon: "payments", label: "Học phí hiển thị trước khi đặt lịch" },
  { icon: "event_available", label: "Lịch học và tin nhắn quản lý trong tài khoản" },
];

const processSteps = [
  {
    description: "Nhập môn học, cấp học hoặc mục tiêu ôn luyện để bắt đầu từ danh sách gia sư phù hợp.",
    icon: "search",
    title: "Tìm gia sư",
  },
  {
    description: "Xem môn dạy, kinh nghiệm, hình thức học, học phí, đánh giá và tín hiệu xác minh.",
    icon: "badge",
    title: "Xem hồ sơ",
  },
  {
    description: "Chọn lịch rảnh, gửi yêu cầu đặt buổi học và trao đổi chi tiết trong tin nhắn.",
    icon: "calendar_month",
    title: "Đặt lịch",
  },
  {
    description: "Theo dõi booking, thanh toán và trạng thái buổi học rõ ràng trong tài khoản.",
    icon: "school",
    title: "Học và theo dõi",
  },
];

const studentBenefits = [
  "So sánh gia sư theo môn học, kinh nghiệm, học phí và hình thức học.",
  "Xem hồ sơ trước khi liên hệ, hạn chế quyết định vội hoặc thiếu thông tin.",
  "Đặt lịch, nhắn tin và theo dõi thanh toán trong cùng một nơi.",
];

const tutorBenefits = [
  "Tạo hồ sơ chuyên môn để học viên và phụ huynh hiểu rõ thế mạnh của bạn.",
  "Quản lý yêu cầu đặt lịch, tin nhắn và buổi học theo từng tài khoản.",
  "Hiển thị học phí, môn dạy và hình thức học rõ ràng ngay từ đầu.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <LandingHeader />

      <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-14 pt-28 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.8fr)] lg:px-10 lg:pb-20 lg:pt-32">
        <div className="min-w-0">
          <StatusBadge tone="info">Marketplace gia sư cho học viên Việt Nam</StatusBadge>

          <div className="mt-5 max-w-3xl space-y-5">
            <h1 className="text-4xl font-black leading-tight text-[var(--on-surface)] text-balance sm:text-5xl lg:text-6xl">
              Tìm gia sư phù hợp, xem hồ sơ rõ ràng, đặt lịch học dễ dàng
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--on-surface-variant)] sm:text-lg sm:leading-8">
              TutorConnect giúp học viên và phụ huynh tìm gia sư theo môn học, cấp học, học phí và lịch rảnh. Trước khi đặt lịch, bạn có thể xem hồ sơ, kinh nghiệm, đánh giá và trạng thái xác minh của gia sư.
            </p>
          </div>

          <form
            action="/tutors"
            className="mt-7 grid gap-3 rounded-[var(--radius-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 shadow-[var(--shadow-raised)] md:grid-cols-[minmax(0,1fr)_minmax(190px,0.55fr)_auto]"
            id="search"
          >
            <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] px-4 py-3">
              <Icon className="text-[22px] text-[var(--primary)]" name="menu_book" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-bold text-[var(--on-surface-variant)]">Môn học hoặc mục tiêu</span>
                <input
                  className="w-full bg-transparent p-0 text-base font-semibold text-[var(--on-surface)] outline-none placeholder:text-[var(--outline)]"
                  name="q"
                  placeholder="Toán lớp 9, IELTS, Vật lý..."
                  type="text"
                />
              </span>
            </label>

            <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] px-4 py-3">
              <Icon className="text-[22px] text-[var(--primary)]" name="school" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-bold text-[var(--on-surface-variant)]">Trình độ</span>
                <select
                  className="w-full bg-transparent p-0 text-base font-semibold text-[var(--on-surface)] outline-none"
                  name="level"
                >
                  <option value="">Tất cả</option>
                  <option value="PRIMARY">Tiểu học</option>
                  <option value="LOWER_SECONDARY">Cấp 2</option>
                  <option value="HIGH_SCHOOL">Cấp 3</option>
                  <option value="UNIVERSITY">Đại học</option>
                  <option value="EXAM_PREP">Luyện thi</option>
                </select>
              </span>
            </label>

            <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)] focus:shadow-[var(--focus-ring)] focus:outline-none" type="submit">
              <Icon className="text-[20px]" name="search" />
              Tìm gia sư ngay
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {trustSignals.map((signal) => (
              <div
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-xs font-bold text-[var(--on-surface-variant)]"
                key={signal.label}
              >
                <Icon className="text-[18px] text-[var(--primary)]" name={signal.icon} />
                {signal.label}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)] focus:shadow-[var(--focus-ring)] focus:outline-none"
              href="/tutors"
            >
              <Icon className="text-[20px]" name="person_search" />
              Xem danh sách gia sư
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-3 text-sm font-black text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
              href="/register"
            >
              <Icon className="text-[20px]" name="workspace_premium" />
              Đăng ký làm gia sư
            </Link>
          </div>
        </div>

        <div className="relative h-[360px] sm:h-[460px] lg:h-[560px]">
          <div className="absolute inset-4 rounded-[var(--radius-xl)] bg-[var(--primary-fixed)]" />
          <div className="relative h-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[var(--shadow-raised)]">
            <Image
              alt="Học viên và gia sư trao đổi trong buổi học"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              src={heroImage}
              unoptimized
            />
            <div className="absolute inset-x-5 bottom-5 grid gap-3">
              <Card className="bg-[var(--surface-container-lowest)]/95 p-4 shadow-[var(--shadow-panel)]" tone="default">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-full)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
                    <Icon fill name="verified" />
                  </span>
                  <div>
                    <p className="font-black text-[var(--on-surface)]">Hồ sơ trước, quyết định sau</p>
                    <p className="mt-1 text-sm leading-5 text-[var(--on-surface-variant)]">
                      Xem môn dạy, kinh nghiệm, học phí và lịch rảnh trước khi gửi yêu cầu đặt lịch.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 py-12 sm:px-8 lg:px-10" id="how-it-works">
        <div className="mx-auto max-w-[1200px]">
          <SectionHeading
            description="Flow được thiết kế theo đúng hành trình học viên cần: tìm, so sánh, đặt lịch, rồi theo dõi buổi học."
            title="Cách đặt lịch học trên TutorConnect"
          />

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {processSteps.map((step, index) => (
              <article className="relative rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5" key={step.title}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-full)] bg-[var(--primary-fixed)] text-[var(--primary)]">
                    <Icon name={step.icon} />
                  </span>
                  <span className="text-sm font-black text-[var(--outline)]">{index + 1}</span>
                </div>
                <h3 className="text-lg font-black text-[var(--on-surface)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-6 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-20" id="resources">
        <Card className="p-6 sm:p-7" tone="default">
          <SectionHeading
            description="Dành cho học viên và phụ huynh muốn chọn gia sư dựa trên thông tin cụ thể, không chỉ lời giới thiệu."
            title="Phụ huynh dễ yên tâm hơn khi có đủ thông tin"
          />
          <BenefitList items={studentBenefits} />
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-[var(--on-primary)] transition hover:bg-[var(--primary-container)] focus:shadow-[var(--focus-ring)] focus:outline-none"
            href="/tutors"
          >
            <Icon className="text-[20px]" name="person_search" />
            Tìm gia sư phù hợp
          </Link>
        </Card>

        <Card className="p-6 sm:p-7" tone="subtle">
          <SectionHeading
            description="Dành cho gia sư muốn trình bày chuyên môn rõ ràng và quản lý lớp học gọn hơn."
            title="Gia sư có nơi xây dựng hồ sơ và nhận lớp"
          />
          <BenefitList items={tutorBenefits} />
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-2.5 text-sm font-black text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
            href="/register"
          >
            <Icon className="text-[20px]" name="workspace_premium" />
            Bắt đầu hồ sơ gia sư
          </Link>
        </Card>
      </section>
    </main>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-black leading-tight text-[var(--on-surface)] text-balance sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)] sm:text-base sm:leading-7">{description}</p>
    </div>
  );
}

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li className="flex gap-3 text-sm font-semibold leading-6 text-[var(--on-surface)]" key={item}>
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[var(--radius-full)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
            <Icon className="text-[18px]" fill name="check" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
