import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditAction,
  Prisma,
  SubjectLevel,
  TutorDocumentType,
  TutorVerificationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateTutorDocumentDto } from './dto/create-tutor-document.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { UpsertTutorProfileDto } from './dto/upsert-tutor-profile.dto';

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

type TutorProfileWithRelations = Prisma.TutorProfileGetPayload<{
  include: typeof tutorProfileInclude;
}>;

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

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
      avatarUrl: null,
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

      await tx.adminAuditLog.create({
        data: {
          actorId: admin.id,
          action: AdminAuditAction.TUTOR_APPROVED,
          resourceType: 'tutor_profile',
          resourceId: id,
        },
      });

      return updated;
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
      avatarUrl: null,
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
      filePath: document.filePath,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      rejectionReason: document.rejectionReason,
      reviewedAt: document.reviewedAt?.toISOString() ?? null,
    };
  }
}
