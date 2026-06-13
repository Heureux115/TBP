import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditAction,
  BookingStatus,
  DisputeStatus,
  NotificationType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import {
  ATTACHMENT_MAX_FILES,
  MultipartFile,
  saveUploadFile,
} from '../common/file-storage';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';

const disputeInclude = {
  openedBy: true,
  resolvedBy: true,
  booking: {
    include: {
      student: true,
      tutorProfile: { include: { user: true } },
    },
  },
  payment: true,
  messages: {
    include: {
      author: true,
      attachments: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.DisputeInclude;

type DisputeWithRelations = Prisma.DisputeGetPayload<{
  include: typeof disputeInclude;
}>;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateDisputeDto) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can open disputes');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, studentId: user.id, deletedAt: null },
      include: {
        payment: true,
        tutorProfile: { include: { user: true } },
        student: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (!booking.payment || booking.payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('only paid bookings can be disputed');
    }

    const existing = await this.prisma.dispute.findFirst({
      where: {
        bookingId: booking.id,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('booking already has an open dispute');
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          bookingId: booking.id,
          paymentId: booking.payment!.id,
          openedById: user.id,
          reason: dto.reason.trim(),
          messages: {
            create: {
              authorId: user.id,
              body: dto.reason.trim(),
            },
          },
        },
        include: disputeInclude,
      });

      await this.notifyAdmins(tx, {
        title: 'Dispute mới cần xử lý',
        body: `${booking.student.fullName} mở dispute cho buổi học với ${booking.tutorProfile.user.fullName}.`,
        actionUrl: '/admin/disputes',
      });

      await this.notifications.create(tx, {
        userId: booking.tutorProfile.userId,
        type: NotificationType.DISPUTE_UPDATED,
        title: 'Học viên đã mở dispute',
        body: `${booking.student.fullName} đã mở dispute cho buổi học.`,
        actionUrl: `/bookings/${booking.id}`,
      });

      return created;
    });

    return this.serialize(dispute);
  }

  async listMine(user: AuthenticatedUser) {
    const where: Prisma.DisputeWhereInput =
      user.role === UserRole.STUDENT
        ? { openedById: user.id }
        : user.role === UserRole.TUTOR
          ? { booking: { tutorProfile: { userId: user.id } } }
          : {};

    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TUTOR) {
      throw new ForbiddenException(
        'only students and tutors can view disputes',
      );
    }

    const disputes = await this.prisma.dispute.findMany({
      where,
      include: disputeInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return disputes.map((dispute) => this.serialize(dispute));
  }

  async getMine(user: AuthenticatedUser, id: string) {
    const dispute = await this.getDisputeOrThrow(id);
    this.assertCanView(user, dispute);
    return this.serialize(dispute);
  }

  async addMessage(
    user: AuthenticatedUser,
    id: string,
    dto: AddDisputeMessageDto,
    files: MultipartFile[] = [],
  ) {
    const dispute = await this.getDisputeOrThrow(id);
    this.assertCanView(user, dispute);
    this.assertOpen(dispute);

    if (files.length > ATTACHMENT_MAX_FILES) {
      throw new BadRequestException('too many attachments');
    }

    const attachments = await Promise.all(
      files.map((file) => saveUploadFile(file, 'disputes')),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.disputeMessage.create({
        data: {
          disputeId: id,
          authorId: user.id,
          body: dto.body.trim(),
          attachments: attachments.length
            ? {
                create: attachments.map((attachment) => ({
                  uploadedById: user.id,
                  url: attachment.url,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  size: attachment.size,
                  kind: attachment.kind,
                })),
              }
            : undefined,
        },
      });

      const saved = await tx.dispute.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: disputeInclude,
      });

      await this.notifyDisputeParticipants(
        tx,
        saved,
        'Dispute có phản hồi mới',
      );
      await this.notifyAdmins(tx, {
        title: 'Dispute có phản hồi mới',
        body: `${user.email} đã bổ sung phản hồi cho dispute #${id.slice(0, 8)}.`,
        actionUrl: '/admin/disputes',
      });

      return saved;
    });

    return this.serialize(updated);
  }

  async listAdmin() {
    const disputes = await this.prisma.dispute.findMany({
      include: disputeInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return disputes.map((dispute) => this.serialize(dispute));
  }

  async markUnderReview(
    admin: AuthenticatedUser,
    id: string,
    adminNote?: string,
  ) {
    const dispute = await this.getDisputeOrThrow(id);
    this.assertOpen(dispute);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.dispute.update({
        where: { id },
        data: {
          status: DisputeStatus.UNDER_REVIEW,
          adminNote,
        },
        include: disputeInclude,
      });

      await this.audit(
        tx,
        admin,
        AdminAuditAction.DISPUTE_UNDER_REVIEW,
        id,
        adminNote,
      );

      return saved;
    });

    return this.serialize(updated);
  }

  async resolveRefunded(
    admin: AuthenticatedUser,
    id: string,
    adminNote?: string,
  ) {
    const dispute = await this.getDisputeOrThrow(id);
    this.assertOpen(dispute);

    if (dispute.payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('dispute payment is not refundable');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dispute.payment.payoutStatus === PayoutStatus.RELEASED) {
        const wallet = await tx.tutorWallet.findUnique({
          where: { tutorProfileId: dispute.booking.tutorProfileId },
        });

        if (
          !wallet ||
          wallet.availableBalance.lt(dispute.payment.tutorPayoutAmount)
        ) {
          throw new BadRequestException(
            'released payout cannot be refunded because tutor wallet balance is insufficient',
          );
        }

        await tx.tutorWallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: {
              decrement: dispute.payment.tutorPayoutAmount,
            },
          },
        });
      } else if (dispute.payment.payoutStatus !== PayoutStatus.HELD) {
        throw new BadRequestException('payment payout cannot be refunded');
      }

      await tx.payment.update({
        where: { id: dispute.paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          payoutStatus: PayoutStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: adminNote ?? dispute.reason,
        },
      });

      if (dispute.booking.status !== BookingStatus.COMPLETED) {
        await tx.booking.update({
          where: { id: dispute.bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: adminNote ?? dispute.reason,
          },
        });

        await tx.availabilitySlot.update({
          where: { id: dispute.booking.availabilitySlotId },
          data: { isBooked: false },
        });
      }

      const saved = await tx.dispute.update({
        where: { id },
        data: {
          status: DisputeStatus.RESOLVED_REFUNDED,
          resolvedById: admin.id,
          resolvedAt: new Date(),
          adminNote,
          resolution: 'Refunded by admin',
        },
        include: disputeInclude,
      });

      await this.notifyDisputeParticipants(
        tx,
        saved,
        'Dispute đã được hoàn tiền',
      );
      await this.audit(
        tx,
        admin,
        AdminAuditAction.DISPUTE_RESOLVED_REFUNDED,
        id,
        adminNote,
      );

      return saved;
    });

    return this.serialize(updated);
  }

  async reject(admin: AuthenticatedUser, id: string, adminNote?: string) {
    const dispute = await this.getDisputeOrThrow(id);
    this.assertOpen(dispute);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.dispute.update({
        where: { id },
        data: {
          status: DisputeStatus.REJECTED,
          resolvedById: admin.id,
          resolvedAt: new Date(),
          adminNote,
          resolution: 'Rejected by admin',
        },
        include: disputeInclude,
      });

      await this.notifyDisputeParticipants(tx, saved, 'Dispute đã bị từ chối');
      await this.audit(
        tx,
        admin,
        AdminAuditAction.DISPUTE_REJECTED,
        id,
        adminNote,
      );

      return saved;
    });

    return this.serialize(updated);
  }

  private async getDisputeOrThrow(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: disputeInclude,
    });

    if (!dispute) {
      throw new NotFoundException('dispute not found');
    }

    return dispute;
  }

  private assertOpen(dispute: DisputeWithRelations) {
    if (
      dispute.status !== DisputeStatus.OPEN &&
      dispute.status !== DisputeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('dispute is already resolved');
    }
  }

  private assertCanView(user: AuthenticatedUser, dispute: DisputeWithRelations) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const isStudent = dispute.booking.studentId === user.id;
    const isTutor = dispute.booking.tutorProfile.userId === user.id;

    if (!isAdmin && !isStudent && !isTutor) {
      throw new ForbiddenException('dispute access denied');
    }
  }

  private async notifyAdmins(
    tx: Prisma.TransactionClient,
    payload: { title: string; body: string; actionUrl: string },
  ) {
    const admins = await tx.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: { id: true },
    });

    await this.notifications.createMany(
      tx,
      admins.map((admin) => ({
        userId: admin.id,
        type: NotificationType.DISPUTE_UPDATED,
        ...payload,
      })),
    );
  }

  private async notifyDisputeParticipants(
    tx: Prisma.TransactionClient,
    dispute: DisputeWithRelations,
    title: string,
  ) {
    await this.notifications.createMany(tx, [
      {
        userId: dispute.booking.studentId,
        type: NotificationType.DISPUTE_UPDATED,
        title,
        body:
          dispute.adminNote ??
          dispute.resolution ??
          'Dispute đã được cập nhật.',
        actionUrl: `/bookings/${dispute.bookingId}`,
      },
      {
        userId: dispute.booking.tutorProfile.userId,
        type: NotificationType.DISPUTE_UPDATED,
        title,
        body:
          dispute.adminNote ??
          dispute.resolution ??
          'Dispute đã được cập nhật.',
        actionUrl: `/bookings/${dispute.bookingId}`,
      },
    ]);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    admin: AuthenticatedUser,
    action: AdminAuditAction,
    disputeId: string,
    reason?: string,
  ) {
    await tx.adminAuditLog.create({
      data: {
        actorId: admin.id,
        action,
        resourceType: 'dispute',
        resourceId: disputeId,
        reason,
      },
    });
  }

  private serialize(dispute: DisputeWithRelations) {
    return {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      adminNote: dispute.adminNote,
      resolution: dispute.resolution,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      openedBy: {
        id: dispute.openedBy.id,
        fullName: dispute.openedBy.fullName,
        email: dispute.openedBy.email,
      },
      resolvedBy: dispute.resolvedBy
        ? {
            id: dispute.resolvedBy.id,
            fullName: dispute.resolvedBy.fullName,
            email: dispute.resolvedBy.email,
          }
        : null,
      booking: {
        id: dispute.booking.id,
        status: dispute.booking.status,
        startsAt: dispute.booking.startsAt.toISOString(),
        endsAt: dispute.booking.endsAt.toISOString(),
        student: {
          id: dispute.booking.student.id,
          fullName: dispute.booking.student.fullName,
          email: dispute.booking.student.email,
        },
        tutor: {
          id: dispute.booking.tutorProfile.id,
          fullName: dispute.booking.tutorProfile.user.fullName,
          email: dispute.booking.tutorProfile.user.email,
        },
      },
      payment: {
        id: dispute.payment.id,
        amount: dispute.payment.amount.toString(),
        status: dispute.payment.status,
        payoutStatus: dispute.payment.payoutStatus,
        refundedAt: dispute.payment.refundedAt?.toISOString() ?? null,
      },
      messages: (dispute.messages ?? []).map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: message.author.id,
          fullName: message.author.fullName,
          email: message.author.email,
          role: message.author.role,
        },
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment.id,
          url: attachment.url,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          kind: attachment.kind,
          createdAt: attachment.createdAt.toISOString(),
        })),
      })),
    };
  }
}
