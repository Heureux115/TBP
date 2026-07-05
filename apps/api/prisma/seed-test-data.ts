import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  SubjectLevel,
  TeachingMode,
  TutorDocumentStatus,
  TutorDocumentType,
  TutorVerificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_COST = 12;
const TEST_PASSWORD = 'Test@123456';

type SubjectSeed = {
  name: string;
  slug: string;
  category: string;
};

type TutorSeed = {
  email: string;
  fullName: string;
  phone: string;
  headline: string;
  bio: string;
  experienceYears: number;
  hourlyRate: string;
  teachingMode: TeachingMode;
  locationCity: string;
  locationDistrict: string;
  verificationStatus: TutorVerificationStatus;
  ratingAvg: string;
  totalSessions: number;
  subjects: Array<{ slug: string; level: SubjectLevel }>;
  rejectionReason?: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function weekStart(date = new Date()) {
  const current = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = current.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + offset);
  return current;
}

function slotDate(baseWeekStart: Date, dayOffset: number, hour: number) {
  const date = new Date(baseWeekStart);
  date.setUTCDate(baseWeekStart.getUTCDate() + dayOffset);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

const subjects: SubjectSeed[] = [
  { name: 'Toán học', slug: 'toan-hoc', category: 'Khoa học tự nhiên' },
  { name: 'Vật lý', slug: 'vat-ly', category: 'Khoa học tự nhiên' },
  { name: 'Hóa học', slug: 'hoa-hoc', category: 'Khoa học tự nhiên' },
  { name: 'Ngữ văn', slug: 'ngu-van', category: 'Khoa học xã hội' },
  { name: 'Tiếng Anh', slug: 'tieng-anh', category: 'Ngoại ngữ' },
  { name: 'Tin học', slug: 'tin-hoc', category: 'Công nghệ' },
];

const tutors: TutorSeed[] = [
  {
    email: 'tutor.math.approved@test.local',
    fullName: 'Nguyễn Thu Hà',
    phone: '0901000001',
    headline: 'Thạc sĩ Sư phạm Toán - luyện thi THPT Quốc gia',
    bio: 'Tôi có hơn 8 năm kinh nghiệm dạy Toán cấp 3 và luyện thi đại học. Phương pháp giảng dạy tập trung vào nền tảng, tư duy giải đề và lộ trình cá nhân hóa cho từng học sinh.',
    experienceYears: 8,
    hourlyRate: '250000',
    teachingMode: TeachingMode.BOTH,
    locationCity: 'Hà Nội',
    locationDistrict: 'Cầu Giấy',
    verificationStatus: TutorVerificationStatus.APPROVED,
    ratingAvg: '4.9',
    totalSessions: 124,
    subjects: [
      { slug: 'toan-hoc', level: SubjectLevel.EXAM_PREP },
      { slug: 'vat-ly', level: SubjectLevel.HIGH_SCHOOL },
    ],
  },
  {
    email: 'tutor.english.approved@test.local',
    fullName: 'Trần Minh Quân',
    phone: '0901000002',
    headline: 'IELTS 8.5 - Tiếng Anh giao tiếp và luyện thi',
    bio: 'Tôi xây dựng bài học theo mục tiêu cụ thể: phát âm, phản xạ giao tiếp, IELTS và ngữ pháp nền tảng. Học viên được kiểm tra tiến độ sau mỗi buổi.',
    experienceYears: 5,
    hourlyRate: '400000',
    teachingMode: TeachingMode.ONLINE,
    locationCity: 'TP. Hồ Chí Minh',
    locationDistrict: 'Quận 1',
    verificationStatus: TutorVerificationStatus.APPROVED,
    ratingAvg: '5.0',
    totalSessions: 89,
    subjects: [{ slug: 'tieng-anh', level: SubjectLevel.UNIVERSITY }],
  },
  {
    email: 'tutor.literature.approved@test.local',
    fullName: 'Lê Thị Mai',
    phone: '0901000003',
    headline: 'Giáo viên Ngữ văn trường chuyên',
    bio: 'Tôi giúp học sinh nắm chắc phương pháp đọc hiểu, nghị luận xã hội và nghị luận văn học. Bài học luôn có dàn ý, bài mẫu và phản hồi chi tiết.',
    experienceYears: 10,
    hourlyRate: '300000',
    teachingMode: TeachingMode.OFFLINE,
    locationCity: 'Hà Nội',
    locationDistrict: 'Ba Đình',
    verificationStatus: TutorVerificationStatus.APPROVED,
    ratingAvg: '4.8',
    totalSessions: 210,
    subjects: [{ slug: 'ngu-van', level: SubjectLevel.HIGH_SCHOOL }],
  },
  {
    email: 'tutor.pending@test.local',
    fullName: 'Phạm Hoàng Nam',
    phone: '0901000004',
    headline: 'Sinh viên xuất sắc khoa Vật lý',
    bio: 'Có kinh nghiệm hỗ trợ học sinh mất gốc Vật lý và bồi dưỡng học sinh khá giỏi.',
    experienceYears: 3,
    hourlyRate: '180000',
    teachingMode: TeachingMode.BOTH,
    locationCity: 'Hà Nội',
    locationDistrict: 'Hai Bà Trưng',
    verificationStatus: TutorVerificationStatus.PENDING_REVIEW,
    ratingAvg: '0',
    totalSessions: 0,
    subjects: [{ slug: 'vat-ly', level: SubjectLevel.HIGH_SCHOOL }],
  },
  {
    email: 'tutor.rejected@test.local',
    fullName: 'Vũ Minh Anh',
    phone: '0901000005',
    headline: 'Gia sư Hóa học cấp 3',
    bio: 'Tập trung hệ thống hóa kiến thức Hóa học và luyện dạng bài theo chuyên đề.',
    experienceYears: 4,
    hourlyRate: '220000',
    teachingMode: TeachingMode.ONLINE,
    locationCity: 'Đà Nẵng',
    locationDistrict: 'Hải Châu',
    verificationStatus: TutorVerificationStatus.REJECTED,
    ratingAvg: '0',
    totalSessions: 0,
    subjects: [{ slug: 'hoa-hoc', level: SubjectLevel.HIGH_SCHOOL }],
    rejectionReason: 'Ảnh bằng cấp bị mờ, vui lòng tải lại bản rõ nét hơn.',
  },
  {
    email: 'tutor.draft@test.local',
    fullName: 'Đỗ Gia Bảo',
    phone: '0901000006',
    headline: 'Gia sư Tin học cơ sở',
    bio: 'Hỗ trợ học sinh làm quen lập trình và tư duy thuật toán.',
    experienceYears: 2,
    hourlyRate: '200000',
    teachingMode: TeachingMode.ONLINE,
    locationCity: 'Hà Nội',
    locationDistrict: 'Đống Đa',
    verificationStatus: TutorVerificationStatus.DRAFT,
    ratingAvg: '0',
    totalSessions: 0,
    subjects: [{ slug: 'tin-hoc', level: SubjectLevel.LOWER_SECONDARY }],
  },
];

async function seedSubjects(prisma: PrismaClient) {
  const result = new Map<string, string>();

  for (const subject of subjects) {
    const saved = await prisma.subject.upsert({
      where: { slug: subject.slug },
      create: { ...subject, isActive: true },
      update: {
        name: subject.name,
        category: subject.category,
        isActive: true,
      },
    });

    result.set(subject.slug, saved.id);
  }

  return result;
}

async function seedStudent(prisma: PrismaClient, passwordHash: string) {
  await prisma.user.upsert({
    where: { email: 'student@test.local' },
    create: {
      email: 'student@test.local',
      passwordHash,
      fullName: 'Nguyễn Văn Học',
      phone: '0902000001',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      fullName: 'Nguyễn Văn Học',
      phone: '0902000001',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    },
  });
}

async function seedTutor(
  prisma: PrismaClient,
  seed: TutorSeed,
  subjectIds: Map<string, string>,
  passwordHash: string,
) {
  const now = new Date();
  const isApproved = seed.verificationStatus === TutorVerificationStatus.APPROVED;
  const isRejected = seed.verificationStatus === TutorVerificationStatus.REJECTED;
  const isSubmitted = seed.verificationStatus !== TutorVerificationStatus.DRAFT;

  const user = await prisma.user.upsert({
    where: { email: seed.email },
    create: {
      email: seed.email,
      passwordHash,
      fullName: seed.fullName,
      phone: seed.phone,
      role: UserRole.TUTOR,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: now,
    },
    update: {
      passwordHash,
      fullName: seed.fullName,
      phone: seed.phone,
      role: UserRole.TUTOR,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: now,
      deletedAt: null,
    },
  });

  const profile = await prisma.tutorProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      headline: seed.headline,
      bio: seed.bio,
      experienceYears: seed.experienceYears,
      hourlyRate: new Prisma.Decimal(seed.hourlyRate),
      teachingMode: seed.teachingMode,
      locationCity: seed.locationCity,
      locationDistrict: seed.locationDistrict,
      verificationStatus: seed.verificationStatus,
      verificationSubmittedAt: isSubmitted ? now : null,
      approvedAt: isApproved ? now : null,
      rejectedAt: isRejected ? now : null,
      rejectionReason: seed.rejectionReason ?? null,
      ratingAvg: new Prisma.Decimal(seed.ratingAvg),
      totalSessions: seed.totalSessions,
    },
    update: {
      headline: seed.headline,
      bio: seed.bio,
      experienceYears: seed.experienceYears,
      hourlyRate: new Prisma.Decimal(seed.hourlyRate),
      teachingMode: seed.teachingMode,
      locationCity: seed.locationCity,
      locationDistrict: seed.locationDistrict,
      verificationStatus: seed.verificationStatus,
      verificationSubmittedAt: isSubmitted ? now : null,
      approvedAt: isApproved ? now : null,
      rejectedAt: isRejected ? now : null,
      rejectionReason: seed.rejectionReason ?? null,
      ratingAvg: new Prisma.Decimal(seed.ratingAvg),
      totalSessions: seed.totalSessions,
      deletedAt: null,
    },
  });

  await resetTutorRuntimeData(prisma, profile.id);

  await prisma.tutorSubject.deleteMany({
    where: { tutorProfileId: profile.id },
  });

  for (const subject of seed.subjects) {
    const subjectId = subjectIds.get(subject.slug);

    if (!subjectId) {
      throw new Error(`Subject ${subject.slug} was not seeded`);
    }

    await prisma.tutorSubject.create({
      data: {
        tutorProfileId: profile.id,
        subjectId,
        level: subject.level,
      },
    });
  }

  await prisma.tutorDocument.deleteMany({
    where: { tutorProfileId: profile.id },
  });

  const documentStatus = isRejected
    ? TutorDocumentStatus.REJECTED
    : isApproved
      ? TutorDocumentStatus.APPROVED
      : TutorDocumentStatus.PENDING;

  const documentTypes = [
    TutorDocumentType.NATIONAL_ID_FRONT,
    TutorDocumentType.NATIONAL_ID_BACK,
    TutorDocumentType.DEGREE,
  ];

  for (const type of documentTypes) {
    await prisma.tutorDocument.create({
      data: {
        tutorProfileId: profile.id,
        uploadedById: user.id,
        type,
        status: documentStatus,
        fileName: `${seed.email}-${type}.pdf`,
        filePath: `seed/${seed.email}/${type}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 512_000,
        reviewedAt: isSubmitted ? now : null,
        rejectionReason: isRejected && type === TutorDocumentType.DEGREE ? seed.rejectionReason : null,
      },
    });
  }

  await prisma.availabilitySlot.deleteMany({
    where: { tutorProfileId: profile.id },
  });

  if (isApproved) {
    const start = weekStart();
    const hours = [8, 10, 14, 19, 20];
    const minBookableStart = new Date(Date.now() + 60 * 60 * 1000);

    for (let day = 0; day < 7; day += 1) {
      for (const hour of hours) {
        if ((day + hour + seed.email.length) % 3 === 0) {
          continue;
        }

        const startsAt = slotDate(start, day, hour);
        if (startsAt <= minBookableStart) {
          continue;
        }

        await prisma.availabilitySlot.create({
          data: {
            tutorProfileId: profile.id,
            startsAt,
            endsAt: addHours(startsAt, 2),
            isBooked: (day + hour) % 5 === 0,
          },
        });
      }
    }
  }

  return profile.id;
}

async function resetTutorRuntimeData(prisma: PrismaClient, tutorProfileId: string) {
  await prisma.review.deleteMany({
    where: { tutorProfileId },
  });

  await prisma.payment.deleteMany({
    where: {
      booking: {
        tutorProfileId,
      },
    },
  });

  await prisma.booking.deleteMany({
    where: { tutorProfileId },
  });

  const wallet = await prisma.tutorWallet.findUnique({
    where: { tutorProfileId },
    select: { id: true },
  });

  if (wallet) {
    await prisma.withdrawal.deleteMany({
      where: { walletId: wallet.id },
    });
    await prisma.tutorWallet.delete({
      where: { id: wallet.id },
    });
  }
}

async function main() {
  const connectionString = requireEnv('DATABASE_URL');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_COST);
    const subjectIds = await seedSubjects(prisma);
    await seedStudent(prisma, passwordHash);

    const tutorIds: string[] = [];

    for (const tutor of tutors) {
      tutorIds.push(await seedTutor(prisma, tutor, subjectIds, passwordHash));
    }

    console.log('Test data is ready.');
    console.log(`Default test password: ${TEST_PASSWORD}`);
    console.log('Student: student@test.local');
    console.log('Approved tutors:');
    tutors
      .filter((tutor) => tutor.verificationStatus === TutorVerificationStatus.APPROVED)
      .forEach((tutor, index) => console.log(`- ${tutor.email} -> /tutors/${tutorIds[index]}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  console.error(`Failed to seed test data: ${message}`);
  process.exit(1);
});
