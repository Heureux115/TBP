import { LandingHeader } from "@/components/landing-header";

const studentAvatars = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBRI1VJIVKH9rX1DZIGfi7L7s5VnJcuM9WQL83JCriJ3YIbL_Uo08EipG9Lu6knjOCqv9ltnAZgy7RtCaVwHpRZvHhZVHYep0J_zLHAphxB5Y8x1y_f_zO1obACHqj0bM35e7nBqcEvcnfK9zsI8rbJ9TlsIFgBgZhpUkO5_i9cRwcJEOfypxlen270WKZsW8kbKBPeCyBYuEhiuRZMbYe99JC96pJ5HBfU35NfQ-PLTP5VFw9BgQoqwkz9wo2_xe1roDk5vBd54j0",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB4hptlCAp_SJYqyrhgk_q1-j4kVd-kpAAaLdilFIGaXigwjT3bAq2joqX3mhcMFZmTj5X8icYrKUL9G1sdJ8950ZnrQ7M1IgTl7JyOxLNSBJa4dDTN0HMFIspRR7L6O-3VCHLfWO633kP_2End70JdRf5BrNt02dJ8_uyFNHhb1WZGFuo0SyvgBm165K0Mm-UEUq0gRptI9B6o9MI0pCvCrn7xA_gwWgQsgUqdiHBBqffK06MPp8g1Fn9inM-sh2RVmUGQaJvks7s",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuANGjhiiDk4PWtQRQZzPqu8shb4oJK6thxC8fyf98PKqqUyMIH2NOQ_02olPWEHIElqyyhP8t-zmzbBSSN5r6MEksq-sfQARXYk7fpuxItZp1W8Tq7jZaNWxYr2Z6a5Cw2Zp0j8P_hHoOiiGKwLksxxqLHmQ8DrZzR2PZTyFPXEXMfvaFpyMMGHRyd5U8tRYrjwmC2irgMrU2VKZjtXBtqB8OM1rsvmGAvVjGWcf3yvuPuW6bUdVQvoMa4UhgqhSEHJNGAllwNvXV8",
];

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDKPiaahkmChpMULSQYMFcmdW5et3WPVTEhD7KiyFGnJVW_vaVSa1Yz7q1SCA5r4_UCghTl6DeFrIX5TzSzbjFz8TJ4RGhcQIX5MAcEILPjI-iXBsGKVyxxB0jhIp8Vcy8NGf0YH9FdvEEqqz50jucIwrCFuLe4XsmumAbJD0vgwt4j2Yls_ZcakZWZ-FP1mYob9LmzIJz_MIMlm4VOMEcDltAJa6vR3FF32Br0FRClha5TzQasyiJgbUHVDiqK-SsXoI2A1Nnz3Rc";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d]">
      <LandingHeader />

      <section className="grid w-full grid-cols-1 items-center gap-10 px-5 pb-16 pt-32 sm:px-8 lg:grid-cols-12 lg:px-12 2xl:px-16">
        <div className="relative z-10 flex max-w-5xl flex-col gap-6 lg:col-span-7">
          <div className="flex w-fit items-center gap-2 rounded-full border border-[#c1c7d1] bg-[#f0f3ff] px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[#fea619]" />
            <span className="text-xs font-medium text-[#414750]">
              Nền tảng học tập trực tuyến hàng đầu
            </span>
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl leading-tight font-bold text-[#111c2d] sm:text-6xl">
              Tìm gia sư giỏi,
              <br />
              <span className="text-[#004271]">học tập hiệu quả</span>
            </h1>
            <p className="max-w-xl text-lg leading-8 text-[#414750]">
              Kết nối với hàng ngàn gia sư chuyên nghiệp. Cá nhân hóa lộ trình học tập để đạt
              kết quả tốt nhất.
            </p>
          </div>

          <form
            action="/tutors"
            className="relative z-20 mt-2 flex flex-col gap-3 rounded-xl border border-[#c1c7d1] bg-white p-2 shadow-[0_10px_25px_rgba(30,41,59,0.1)] md:flex-row"
            id="search"
          >
            <div className="flex flex-1 items-center border-b border-[#c1c7d1] px-4 py-3 md:border-r md:border-b-0">
              <span className="material-symbols-outlined mr-3 text-[#004271]">menu_book</span>
              <div className="flex w-full flex-col">
                <label className="text-xs font-medium text-[#414750]">Môn học</label>
                <input
                  className="w-full border-none bg-transparent p-0 text-base text-[#111c2d] outline-none placeholder:text-[#717781]"
                  name="q"
                  placeholder="VD: Toán, Tiếng Anh..."
                  type="text"
                />
              </div>
            </div>

            <div className="flex flex-1 items-center px-4 py-3">
              <span className="material-symbols-outlined mr-3 text-[#004271]">school</span>
              <div className="flex w-full flex-col">
                <label className="text-xs font-medium text-[#414750]">Trình độ</label>
                <select
                  className="w-full border-none bg-transparent p-0 text-base text-[#111c2d] outline-none"
                  name="level"
                >
                  <option value="">Tất cả trình độ</option>
                  <option value="PRIMARY">Tiểu học</option>
                  <option value="LOWER_SECONDARY">Cấp 2</option>
                  <option value="HIGH_SCHOOL">Cấp 3</option>
                  <option value="UNIVERSITY">Đại học</option>
                  <option value="EXAM_PREP">Luyện thi</option>
                </select>
              </div>
            </div>

            <button className="flex items-center justify-center gap-2 rounded-lg bg-[#855300] px-8 py-4 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-[#653e00]">
              <span className="material-symbols-outlined text-[20px]">search</span>
              Tìm kiếm
            </button>
          </form>

          <div className="mt-2 flex items-center gap-4">
            <div className="flex -space-x-3">
              {studentAvatars.map((src, index) => (
                <img
                  alt="Student"
                  className="h-10 w-10 rounded-full border-2 border-white object-cover"
                  key={src}
                  src={src}
                  style={{ zIndex: studentAvatars.length - index }}
                />
              ))}
            </div>
            <p className="text-sm text-[#414750]">
              <strong className="font-semibold text-[#111c2d]">10,000+</strong> học viên đã tin
              tưởng
            </p>
          </div>
        </div>

        <div className="relative hidden justify-self-end lg:col-span-5 lg:block lg:w-full lg:max-w-[620px] 2xl:max-w-[720px]">
          <div className="absolute inset-0 rotate-3 rounded-[2rem] bg-[#004271]/5" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-[#c1c7d1] bg-white shadow-[0_4px_12px_rgba(30,41,59,0.05)]">
            <img alt="Tutor and student" className="h-full w-full object-cover" src={heroImage} />
            <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-xl border border-[#c1c7d1] bg-white p-4 shadow-[0_10px_25px_rgba(30,41,59,0.1)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006444] text-white">
                <span className="material-symbols-outlined icon-fill text-[20px]">verified</span>
              </div>
              <div>
                <p className="text-xs font-medium text-[#414750]">Gia sư đã xác thực</p>
                <p className="text-xl font-bold text-[#111c2d]">100%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 w-full border-t border-[#c1c7d1] bg-[#d8e3fb] px-5 py-12 sm:px-8 lg:px-12 2xl:px-16">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="mb-4 block text-xl font-bold text-[#111c2d]">TutorConnect</span>
            <p className="text-sm leading-6 text-[#414750]">
              Kết nối tri thức, kiến tạo tương lai. Nền tảng học tập uy tín hàng đầu Việt Nam.
            </p>
          </div>
          <div id="how-it-works">
            <h2 className="mb-4 text-sm font-semibold text-[#111c2d]">Về chúng tôi</h2>
            <ul className="space-y-2 text-sm text-[#414750]">
              <li>
                <a className="transition hover:text-[#004271]" href="#">
                  About Us
                </a>
              </li>
              <li>
                <a className="transition hover:text-[#004271]" href="#">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
          <div id="resources">
            <h2 className="mb-4 text-sm font-semibold text-[#111c2d]">Pháp lý</h2>
            <ul className="space-y-2 text-sm text-[#414750]">
              <li>
                <a className="transition hover:text-[#004271]" href="#">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a className="transition hover:text-[#004271]" href="#">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-[#c1c7d1]/60 pt-6 md:flex-row">
          <p className="text-sm text-[#414750]">
            © 2026 TutorConnect. Empowering education through technology.
          </p>
          <a className="rounded-full p-1 text-[#414750] transition hover:text-[#004271]" href="#">
            Tiếng Việt
          </a>
        </div>
      </footer>
    </main>
  );
}
