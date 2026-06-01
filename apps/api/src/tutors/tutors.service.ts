import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import {
  AdminAuditAction,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  TeachingMode,
  SubjectLevel,
  TutorDocumentStatus,
  TutorDocumentType,
  TutorVerificationStatus,
  UserStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateTutorDocumentDto } from './dto/create-tutor-document.dto';
import {
  AvailabilityRepeat,
  CreateAvailabilitySlotDto,
} from './dto/tutor-availability.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { UpsertTutorProfileDto } from './dto/upsert-tutor-profile.dto';
import {
  SearchTutorsDto,
  TutorSearchSort,
} from './dto/discovery/search-tutors.dto';

const tutorProfileInclude = {
  user: true,
  subjects: {
    include: {
      subject: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  documents: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.TutorProfileInclude;

const publicTutorInclude = {
  user: true,
  subjects: {
    include: {
      subject: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.TutorProfileInclude;

type TutorProfileWithRelations = Prisma.TutorProfileGetPayload<{
  include: typeof tutorProfileInclude;
}>;

type PublicTutorWithRelations = Prisma.TutorProfileGetPayload<{
  include: typeof publicTutorInclude;
}>;

type MultipartFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPublicTutors(query: SearchTutorsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where = this.buildPublicTutorWhere(query);
    const orderBy = this.buildPublicTutorOrderBy(query.sort);

    const [total, profiles] = await this.prisma.$transaction([
      this.prisma.tutorProfile.count({ where }),
      this.prisma.tutorProfile.findMany({
        where,
        include: publicTutorInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: profiles.map((profile) => this.serializePublicTutorCard(profile)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPublicTutor(id: string) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id,
        verificationStatus: TutorVerificationStatus.APPROVED,
        deletedAt: null,
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      include: {
        ...publicTutorInclude,
        documents: {
          where: {
            deletedAt: null,
            status: TutorDocumentStatus.APPROVED,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('tutor not found');
    }

    return {
      ...this.serializePublicTutorCard(profile),
      bio: profile.bio,
      introVideoUrl: profile.introVideoUrl,
      approvedAt: profile.approvedAt?.toISOString() ?? null,
      verifiedDocuments: profile.documents.map((document) => ({
        id: document.id,
        type: document.type,
        status: document.status,
      })),
    };
  }

  async getPublicTutorAvailability(id: string, weekStart?: string) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id,
        verificationStatus: TutorVerificationStatus.APPROVED,
        deletedAt: null,
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('tutor not found');
    }

    const start = this.normalizeWeekStart(weekStart);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        tutorProfileId: id,
        deletedAt: null,
        startsAt: {
          gte: start,
          lt: end,
        },
        isBooked: false,
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    return {
      tutorId: id,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      slots: slots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        isBooked: slot.isBooked,
        isAvailable: !slot.isBooked,
      })),
    };
  }

  async getMyProfile(user: AuthenticatedUser) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      include: tutorProfileInclude,
    });

    return this.serializeProfile(profile);
  }

  async getMyAvailability(user: AuthenticatedUser, weekStart?: string) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });

    return this.getAvailabilityForProfile(profile.id, weekStart);
  }

  async createAvailabilitySlot(
    user: AuthenticatedUser,
    dto: CreateAvailabilitySlotDto,
  ) {
    this.assertTutor(user);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const repeat = dto.repeat ?? AvailabilityRepeat.NONE;
    const occurrences =
      repeat === AvailabilityRepeat.NONE ? 1 : (dto.occurrences ?? 4);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('availability time must be valid');
    }

    if (startsAt <= new Date()) {
      throw new BadRequestException('availability slot must be in the future');
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException('availability end must be after start');
    }

    const durationMinutes =
      (endsAt.getTime() - startsAt.getTime()) / (60 * 1000);

    if (durationMinutes < 30 || durationMinutes > 240) {
      throw new BadRequestException(
        'availability slot duration must be between 30 and 240 minutes',
      );
    }

    if (occurrences < 1 || occurrences > 24) {
      throw new BadRequestException('occurrences must be between 1 and 24');
    }

    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });

    const slotsToCreate = Array.from({ length: occurrences }, (_, index) => {
      const slotStart = this.shiftAvailabilityDate(startsAt, repeat, index);
      const slotEnd = this.shiftAvailabilityDate(endsAt, repeat, index);

      return { startsAt: slotStart, endsAt: slotEnd };
    });

    const overlapping = await this.prisma.availabilitySlot.findFirst({
      where: {
        tutorProfileId: profile.id,
        deletedAt: null,
        OR: slotsToCreate.map((slot) => ({
          startsAt: { lt: slot.endsAt },
          endsAt: { gt: slot.startsAt },
        })),
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BadRequestException('availability slot overlaps existing slot');
    }

    const created = await this.prisma.$transaction(
      slotsToCreate.map((slot) =>
        this.prisma.availabilitySlot.create({
          data: {
            tutorProfileId: profile.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          },
        }),
      ),
    );

    return {
      slots: created.map((slot) => this.serializeAvailabilitySlot(slot)),
    };
  }

  async deleteAvailabilitySlot(user: AuthenticatedUser, id: string) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('tutor profile not found');
    }

    const slot = await this.prisma.availabilitySlot.findFirst({
      where: { id, tutorProfileId: profile.id, deletedAt: null },
      include: {
        booking: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException('availability slot not found');
    }

    if (slot.booking?.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('completed booking slot cannot be removed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (slot.booking) {
        if (slot.booking.payment?.status === PaymentStatus.PAID) {
          await tx.payment.update({
            where: { id: slot.booking.payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              payoutStatus: PayoutStatus.REFUNDED,
              refundedAt: new Date(),
              refundReason: 'tutor removed the teaching slot',
            },
          });
        } else if (slot.booking.payment?.status === PaymentStatus.PENDING) {
          await tx.payment.update({
            where: { id: slot.booking.payment.id },
            data: {
              status: PaymentStatus.CANCELLED,
              payoutStatus: PayoutStatus.CANCELLED,
            },
          });
        }

        await tx.booking.update({
          where: { id: slot.booking.id },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: 'Gia sư đã xóa lịch dạy.',
          },
        });
      }

      return tx.availabilitySlot.update({
        where: { id },
        data: {
          isBooked: false,
          deletedAt: new Date(),
        },
      });
    });

    return this.serializeAvailabilitySlot(updated);
  }

  async upsertMyProfile(user: AuthenticatedUser, dto: UpsertTutorProfileDto) {
    this.assertTutor(user);

    const profile = await this.prisma.$transaction(async (tx) => {
      const savedProfile = await tx.tutorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          headline: dto.headline,
          bio: dto.bio,
          introVideoUrl: dto.introVideoUrl,
          experienceYears: dto.experienceYears,
          hourlyRate: dto.hourlyRate
            ? new Prisma.Decimal(dto.hourlyRate)
            : undefined,
          teachingMode: dto.teachingMode,
          locationCity: dto.locationCity,
          locationDistrict: dto.locationDistrict,
        },
        update: {
          headline: dto.headline,
          bio: dto.bio,
          introVideoUrl: dto.introVideoUrl,
          experienceYears: dto.experienceYears,
          hourlyRate: dto.hourlyRate
            ? new Prisma.Decimal(dto.hourlyRate)
            : undefined,
          teachingMode: dto.teachingMode,
          locationCity: dto.locationCity,
          locationDistrict: dto.locationDistrict,
          verificationStatus: TutorVerificationStatus.DRAFT,
          rejectionReason: null,
          rejectedAt: null,
        },
      });

      if (dto.subjects) {
        await this.replaceTutorSubjects(tx, savedProfile.id, dto.subjects);
      }

      return tx.tutorProfile.findUniqueOrThrow({
        where: { id: savedProfile.id },
        include: tutorProfileInclude,
      });
    });

    return this.serializeProfile(profile);
  }

  async submitMyVerification(user: AuthenticatedUser) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      include: tutorProfileInclude,
    });

    if (!profile) {
      throw new BadRequestException('tutor profile must be created first');
    }

    this.assertProfileReady(profile);

    const updated = await this.prisma.tutorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: TutorVerificationStatus.PENDING_REVIEW,
        verificationSubmittedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
      include: tutorProfileInclude,
    });

    return this.serializeProfile(updated);
  }

  async getMyDocuments(user: AuthenticatedUser) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      include: { documents: { where: { deletedAt: null } } },
    });

    return (
      profile?.documents.map((document) => this.serializeDocument(document)) ??
      []
    );
  }

  createUploadUrl(user: AuthenticatedUser, dto: UploadUrlDto) {
    this.assertTutor(user);

    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `tutor-documents/${user.id}/${Date.now()}-${safeName}`;

    return {
      uploadUrl: `mock://local-upload/${objectKey}`,
      filePath: objectKey,
      expiresIn: 900,
    };
  }

  async uploadAvatar(user: AuthenticatedUser, file?: MultipartFile) {
    this.assertTutor(user);
    this.assertUploadFile(file, ['image/jpeg', 'image/png', 'image/webp']);

    const stored = await this.storeUpload(file, `avatars/${user.id}`);
    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        avatarUrl: stored.publicUrl,
      },
      update: {
        avatarUrl: stored.publicUrl,
      },
      include: tutorProfileInclude,
    });

    return this.serializeProfile(profile);
  }

  async uploadDocument(
    user: AuthenticatedUser,
    type: TutorDocumentType,
    file?: MultipartFile,
  ) {
    this.assertTutor(user);
    this.assertUploadFile(file, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);

    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    const stored = await this.storeUpload(file, `tutor-documents/${user.id}`);

    const document = await this.prisma.tutorDocument.create({
      data: {
        tutorProfileId: profile.id,
        uploadedById: user.id,
        type,
        fileName: file.originalname,
        filePath: stored.publicUrl,
        mimeType: file.mimetype || 'application/octet-stream',
        fileSizeBytes: file.size,
      },
    });

    return this.serializeDocument(document);
  }

  async createDocument(user: AuthenticatedUser, dto: CreateTutorDocumentDto) {
    this.assertTutor(user);

    const profile = await this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    const document = await this.prisma.tutorDocument.create({
      data: {
        tutorProfileId: profile.id,
        uploadedById: user.id,
        type: dto.type,
        fileName: dto.fileName,
        filePath: dto.filePath,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
      },
    });

    return this.serializeDocument(document);
  }

  async listAdminTutors(status?: TutorVerificationStatus) {
    const profiles = await this.prisma.tutorProfile.findMany({
      where: {
        deletedAt: null,
        ...(status ? { verificationStatus: status } : {}),
      },
      include: {
        user: true,
        _count: {
          select: {
            subjects: true,
            documents: true,
          },
        },
      },
      orderBy: [{ verificationSubmittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return profiles.map((profile) => ({
      id: profile.id,
      fullName: profile.user.fullName,
      email: profile.user.email,
      avatarUrl: this.toPublicUploadUrl(profile.avatarUrl),
      city: profile.locationCity,
      district: profile.locationDistrict,
      subjectCount: profile._count.subjects,
      documentCount: profile._count.documents,
      submittedAt: profile.verificationSubmittedAt?.toISOString() ?? null,
      status: profile.verificationStatus,
    }));
  }

  async getAdminTutor(id: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id },
      include: tutorProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('tutor profile not found');
    }

    return this.serializeProfile(profile);
  }

  async approveTutor(admin: AuthenticatedUser, id: string) {
    this.assertAdmin(admin);

    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tutorProfile.update({
        where: { id },
        data: {
          verificationStatus: TutorVerificationStatus.APPROVED,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
        include: tutorProfileInclude,
      });

      await tx.tutorDocument.updateMany({
        where: {
          tutorProfileId: id,
          deletedAt: null,
          status: TutorDocumentStatus.PENDING,
        },
        data: {
          status: TutorDocumentStatus.APPROVED,
          reviewedById: admin.id,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: admin.id,
          action: AdminAuditAction.TUTOR_APPROVED,
          resourceType: 'tutor_profile',
          resourceId: id,
        },
      });

      return tx.tutorProfile.findUniqueOrThrow({
        where: { id: updated.id },
        include: tutorProfileInclude,
      });
    });

    return this.serializeProfile(profile);
  }

  async rejectTutor(admin: AuthenticatedUser, id: string, reason: string) {
    this.assertAdmin(admin);

    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tutorProfile.update({
        where: { id },
        data: {
          verificationStatus: TutorVerificationStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        include: tutorProfileInclude,
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: admin.id,
          action: AdminAuditAction.TUTOR_REJECTED,
          resourceType: 'tutor_profile',
          resourceId: id,
          reason,
        },
      });

      return updated;
    });

    return this.serializeProfile(profile);
  }

  private async replaceTutorSubjects(
    tx: Prisma.TransactionClient,
    tutorProfileId: string,
    subjects: Array<{ subjectId: string; level: SubjectLevel }>,
  ) {
    const subjectIds = [
      ...new Set(subjects.map((subject) => subject.subjectId)),
    ];
    const existingSubjects = await tx.subject.findMany({
      where: { id: { in: subjectIds }, isActive: true },
      select: { id: true },
    });

    if (existingSubjects.length !== subjectIds.length) {
      throw new BadRequestException('one or more subjects are invalid');
    }

    await tx.tutorSubject.deleteMany({ where: { tutorProfileId } });

    if (!subjects.length) {
      return;
    }

    await tx.tutorSubject.createMany({
      data: subjects.map((subject) => ({
        tutorProfileId,
        subjectId: subject.subjectId,
        level: subject.level,
      })),
      skipDuplicates: true,
    });
  }

  private buildPublicTutorWhere(
    query: SearchTutorsDto,
  ): Prisma.TutorProfileWhereInput {
    const subjectFilters: Prisma.TutorSubjectWhereInput[] = [];

    if (query.subjectId) {
      subjectFilters.push({ subjectId: query.subjectId });
    }

    if (query.level) {
      subjectFilters.push({ level: query.level });
    }

    const where: Prisma.TutorProfileWhereInput = {
      deletedAt: null,
      verificationStatus: TutorVerificationStatus.APPROVED,
      user: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      ...(query.q
        ? {
            OR: [
              { headline: { contains: query.q, mode: 'insensitive' } },
              { bio: { contains: query.q, mode: 'insensitive' } },
              {
                user: { fullName: { contains: query.q, mode: 'insensitive' } },
              },
              {
                subjects: {
                  some: {
                    subject: {
                      name: { contains: query.q, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.city
        ? { locationCity: { contains: query.city, mode: 'insensitive' } }
        : {}),
      ...(query.district
        ? {
            locationDistrict: {
              contains: query.district,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.teachingMode
        ? {
            teachingMode:
              query.teachingMode === TeachingMode.BOTH
                ? TeachingMode.BOTH
                : { in: [query.teachingMode, TeachingMode.BOTH] },
          }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            hourlyRate: {
              ...(query.minPrice !== undefined
                ? { gte: new Prisma.Decimal(query.minPrice) }
                : {}),
              ...(query.maxPrice !== undefined
                ? { lte: new Prisma.Decimal(query.maxPrice) }
                : {}),
            },
          }
        : {}),
      ...(query.minRating !== undefined
        ? { ratingAvg: { gte: new Prisma.Decimal(query.minRating) } }
        : {}),
      ...(subjectFilters.length
        ? {
            subjects: {
              some: {
                AND: subjectFilters,
              },
            },
          }
        : {}),
    };

    return where;
  }

  private buildPublicTutorOrderBy(
    sort?: TutorSearchSort,
  ): Prisma.TutorProfileOrderByWithRelationInput[] {
    switch (sort) {
      case TutorSearchSort.PRICE_ASC:
        return [{ hourlyRate: 'asc' }, { ratingAvg: 'desc' }];
      case TutorSearchSort.PRICE_DESC:
        return [{ hourlyRate: 'desc' }, { ratingAvg: 'desc' }];
      case TutorSearchSort.RATING_DESC:
        return [{ ratingAvg: 'desc' }, { totalSessions: 'desc' }];
      case TutorSearchSort.NEWEST:
        return [{ approvedAt: 'desc' }, { createdAt: 'desc' }];
      case TutorSearchSort.RELEVANCE:
      default:
        return [
          { ratingAvg: 'desc' },
          { totalSessions: 'desc' },
          { approvedAt: 'desc' },
        ];
    }
  }

  private normalizeWeekStart(value?: string) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('weekStart must be a valid ISO date');
    }

    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = start.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + offset);

    return start;
  }

  private async getAvailabilityForProfile(
    tutorProfileId: string,
    weekStart?: string,
  ) {
    const start = this.normalizeWeekStart(weekStart);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        tutorProfileId,
        deletedAt: null,
        startsAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    return {
      tutorId: tutorProfileId,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      slots: slots.map((slot) => this.serializeAvailabilitySlot(slot)),
    };
  }

  private serializeAvailabilitySlot(slot: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    isBooked: boolean;
  }) {
    return {
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      isBooked: slot.isBooked,
      isAvailable: !slot.isBooked,
    };
  }

  private shiftAvailabilityDate(
    value: Date,
    repeat: AvailabilityRepeat,
    index: number,
  ) {
    const shifted = new Date(value);

    if (repeat === AvailabilityRepeat.WEEKLY) {
      shifted.setUTCDate(shifted.getUTCDate() + index * 7);
    }

    if (repeat === AvailabilityRepeat.MONTHLY) {
      shifted.setUTCMonth(shifted.getUTCMonth() + index);
    }

    return shifted;
  }

  private assertUploadFile(
    file: MultipartFile | undefined,
    allowedMimeTypes: string[],
  ): asserts file is MultipartFile {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('unsupported file type');
    }

    const maxSize = file.mimetype === 'application/pdf' ? 8 : 5;

    if (file.size > maxSize * 1024 * 1024) {
      throw new BadRequestException(`file size must be ${maxSize}MB or less`);
    }

    if (!this.extensionFromMime(file.mimetype)) {
      throw new BadRequestException('unsupported file extension');
    }
  }

  private async storeUpload(file: MultipartFile, folder: string) {
    const extension = this.resolveSafeExtension(file);
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '_');
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const relativePath = `${safeFolder}/${fileName}`;
    const uploadRoot = resolve(process.cwd(), 'uploads');
    const absoluteDirectory = resolve(uploadRoot, safeFolder);
    const absolutePath = resolve(absoluteDirectory, fileName);

    if (!absolutePath.startsWith(uploadRoot)) {
      throw new BadRequestException('invalid upload path');
    }

    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      relativePath,
      publicUrl: `/uploads/${relativePath}`,
    };
  }

  private extensionFromMime(mimeType: string) {
    switch (mimeType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'application/pdf':
        return '.pdf';
      default:
        return '';
    }
  }

  private resolveSafeExtension(file: MultipartFile) {
    const extension = extname(file.originalname).toLowerCase();
    const expected = this.extensionFromMime(file.mimetype);
    const aliases: Record<string, string[]> = {
      '.jpg': ['.jpg', '.jpeg'],
      '.png': ['.png'],
      '.webp': ['.webp'],
      '.pdf': ['.pdf'],
    };

    if (!expected) {
      throw new BadRequestException('unsupported file type');
    }

    if (extension && !(aliases[expected] ?? [expected]).includes(extension)) {
      throw new BadRequestException('file extension does not match file type');
    }

    return expected;
  }

  private toPublicUploadUrl(value: string | null) {
    if (!value) {
      return null;
    }

    if (/^https?:\/\//.test(value)) {
      return value;
    }

    const baseUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
    return value.startsWith('/uploads') ? `${baseUrl}${value}` : value;
  }

  private serializePublicTutorCard(profile: PublicTutorWithRelations) {
    return {
      id: profile.id,
      fullName: profile.user.fullName,
      avatarUrl: this.toPublicUploadUrl(profile.avatarUrl),
      headline: profile.headline,
      bioExcerpt: profile.bio
        ? `${profile.bio.slice(0, 180)}${profile.bio.length > 180 ? '...' : ''}`
        : null,
      experienceYears: profile.experienceYears,
      hourlyRate: profile.hourlyRate?.toString() ?? null,
      teachingMode: profile.teachingMode,
      locationCity: profile.locationCity,
      locationDistrict: profile.locationDistrict,
      ratingAvg: profile.ratingAvg.toString(),
      totalSessions: profile.totalSessions,
      verified: true,
      subjects: profile.subjects.map((subject) => ({
        id: subject.id,
        level: subject.level,
        subject: subject.subject,
      })),
    };
  }

  private assertProfileReady(profile: TutorProfileWithRelations) {
    const requiredTypes = [
      TutorDocumentType.NATIONAL_ID_FRONT,
      TutorDocumentType.NATIONAL_ID_BACK,
      TutorDocumentType.DEGREE,
    ];
    const documentTypes = new Set(
      profile.documents.map((document) => document.type),
    );

    const missingRequiredProfileFields = [
      profile.headline,
      profile.bio,
      profile.experienceYears,
      profile.hourlyRate,
      profile.locationCity,
      profile.locationDistrict,
    ].some((value) => value === null || value === undefined || value === '');

    if (missingRequiredProfileFields) {
      throw new BadRequestException('profile information is incomplete');
    }

    if (!profile.subjects.length) {
      throw new BadRequestException(
        'at least one teaching subject is required',
      );
    }

    if (requiredTypes.some((type) => !documentTypes.has(type))) {
      throw new BadRequestException(
        'required verification documents are missing',
      );
    }
  }

  private assertTutor(user: AuthenticatedUser) {
    if (user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('tutor role required');
    }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('admin role required');
    }
  }

  private serializeProfile(profile: TutorProfileWithRelations) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.fullName,
      email: profile.user.email,
      phone: profile.user.phone,
      avatarUrl: this.toPublicUploadUrl(profile.avatarUrl),
      headline: profile.headline,
      bio: profile.bio,
      introVideoUrl: profile.introVideoUrl,
      experienceYears: profile.experienceYears,
      hourlyRate: profile.hourlyRate?.toString() ?? null,
      teachingMode: profile.teachingMode,
      locationCity: profile.locationCity,
      locationDistrict: profile.locationDistrict,
      verificationStatus: profile.verificationStatus,
      verificationSubmittedAt:
        profile.verificationSubmittedAt?.toISOString() ?? null,
      approvedAt: profile.approvedAt?.toISOString() ?? null,
      rejectedAt: profile.rejectedAt?.toISOString() ?? null,
      rejectionReason: profile.rejectionReason,
      subjects: profile.subjects.map((subject) => ({
        id: subject.id,
        level: subject.level,
        subject: subject.subject,
      })),
      documents: profile.documents.map((document) =>
        this.serializeDocument(document),
      ),
    };
  }

  private serializeDocument(document: {
    id: string;
    type: TutorDocumentType;
    status: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSizeBytes: number;
    rejectionReason: string | null;
    reviewedAt: Date | null;
  }) {
    return {
      id: document.id,
      type: document.type,
      status: document.status,
      fileName: document.fileName,
      filePath: this.toPublicUploadUrl(document.filePath) ?? document.filePath,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      rejectionReason: document.rejectionReason,
      reviewedAt: document.reviewedAt?.toISOString() ?? null,
    };
  }
}
