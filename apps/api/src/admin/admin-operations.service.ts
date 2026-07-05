import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditAction,
  BookingStatus,
  NotificationType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  TutorVerificationStatus,
  UserRole,
  UserStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const adminBookingInclude = {
  student: true,
  tutorProfile: {
    include: {
      user: true,
      subjects: {
        include: { subject: true },
      },
    },
  },
  payment: true,
} satisfies Prisma.BookingInclude;

const adminPaymentInclude = {
  payer: true,
  booking: {
    include: {
      student: true,
      tutorProfile: {
        include: {
          user: true,
          subjects: {
            include: { subject: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

type AdminBooking = Prisma.BookingGetPayload<{
  include: typeof adminBookingInclude;
}>;
type AdminPayment = Prisma.PaymentGetPayload<{
  include: typeof adminPaymentInclude;
}>;

const adminWithdrawalInclude = {
  wallet: true,
  tutorProfile: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.WithdrawalInclude;

type AdminWithdrawal = Prisma.WithdrawalGetPayload<{
  include: typeof adminWithdrawalInclude;
}>;

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listBookings(admin: AuthenticatedUser) {
    const take = 200;
    const bookings = await this.prisma.booking.findMany({
      where: { deletedAt: null },
      include: adminBookingInclude,
      orderBy: { startsAt: 'desc' },
      take,
    });

    await this.auditRead(admin, AdminAuditAction.BOOKINGS_VIEWED, 'booking', {
      endpoint: 'GET /admin/bookings',
      take,
      resultCount: bookings.length,
    });

    return bookings.map((booking) => this.serializeBooking(booking));
  }

  async listPayments(admin: AuthenticatedUser) {
    const take = 200;
    const payments = await this.prisma.payment.findMany({
      include: adminPaymentInclude,
      orderBy: { createdAt: 'desc' },
      take,
    });

    await this.auditRead(admin, AdminAuditAction.PAYMENTS_VIEWED, 'payment', {
      endpoint: 'GET /admin/payments',
      take,
      resultCount: payments.length,
    });

    return payments.map((payment) => this.serializePayment(payment));
  }

  async refundPayment(
    _admin: AuthenticatedUser,
    id: string,
    reason = 'admin refund',
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: adminPaymentInclude,
    });

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('only paid payments can be refunded');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (payment.payoutStatus === PayoutStatus.RELEASED) {
        const wallet = await tx.tutorWallet.findUnique({
          where: { tutorProfileId: payment.booking.tutorProfileId },
        });

        if (!wallet || wallet.availableBalance.lt(payment.tutorPayoutAmount)) {
          throw new BadRequestException(
            'released payout cannot be refunded because tutor wallet balance is insufficient',
          );
        }

        await tx.tutorWallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { decrement: payment.tutorPayoutAmount },
          },
        });
      } else if (payment.payoutStatus !== PayoutStatus.HELD) {
        throw new BadRequestException('payment payout cannot be refunded');
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          payoutStatus: PayoutStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: reason,
        },
      });

      if (payment.booking.status !== BookingStatus.COMPLETED) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: reason,
          },
        });

        await tx.availabilitySlot.update({
          where: { id: payment.booking.availabilitySlotId },
          data: { isBooked: false },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorId: _admin.id,
          action: AdminAuditAction.PAYMENT_REFUNDED,
          resourceType: 'payment',
          resourceId: payment.id,
          reason,
        },
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: adminPaymentInclude,
      });
    });

    return this.serializePayment(updated);
  }

  async listWithdrawals() {
    const withdrawals = await this.prisma.withdrawal.findMany({
      include: adminWithdrawalInclude,
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });

    return withdrawals.map((withdrawal) =>
      this.serializeWithdrawal(withdrawal),
    );
  }

  async markWithdrawalProcessing(_admin: AuthenticatedUser, id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: adminWithdrawalInclude,
    });

    if (!withdrawal) {
      throw new NotFoundException('withdrawal not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(
        'only pending withdrawals can be processed',
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: { status: WithdrawalStatus.PROCESSING },
      include: adminWithdrawalInclude,
    });

    await this.notifications.create(this.prisma, {
      userId: withdrawal.tutorProfile.userId,
      type: NotificationType.WITHDRAWAL_UPDATED,
      title: 'Yêu cầu rút tiền đang được xử lý',
      body: `Yêu cầu rút ${withdrawal.amount.toString()} ${withdrawal.currency} đang được admin xử lý.`,
      actionUrl: '/payments',
    });

    await this.prisma.adminAuditLog.create({
      data: {
        actorId: _admin.id,
        action: AdminAuditAction.WITHDRAWAL_PROCESSING,
        resourceType: 'withdrawal',
        resourceId: id,
      },
    });

    return this.serializeWithdrawal(updated);
  }

  async markWithdrawalPaid(_admin: AuthenticatedUser, id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: adminWithdrawalInclude,
    });

    if (!withdrawal) {
      throw new NotFoundException('withdrawal not found');
    }

    if (
      withdrawal.status !== WithdrawalStatus.PENDING &&
      withdrawal.status !== WithdrawalStatus.PROCESSING
    ) {
      throw new BadRequestException('withdrawal cannot be marked paid');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PAID,
        processedAt: new Date(),
      },
      include: adminWithdrawalInclude,
    });

    await this.notifications.create(this.prisma, {
      userId: withdrawal.tutorProfile.userId,
      type: NotificationType.WITHDRAWAL_UPDATED,
      title: 'Yêu cầu rút tiền đã được thanh toán',
      body: `Admin đã xác nhận chuyển ${withdrawal.amount.toString()} ${withdrawal.currency}.`,
      actionUrl: '/payments',
    });

    await this.prisma.adminAuditLog.create({
      data: {
        actorId: _admin.id,
        action: AdminAuditAction.WITHDRAWAL_PAID,
        resourceType: 'withdrawal',
        resourceId: id,
      },
    });

    return this.serializeWithdrawal(updated);
  }

  async rejectWithdrawal(
    _admin: AuthenticatedUser,
    id: string,
    reason: string,
  ) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: adminWithdrawalInclude,
    });

    if (!withdrawal) {
      throw new NotFoundException('withdrawal not found');
    }

    if (
      withdrawal.status !== WithdrawalStatus.PENDING &&
      withdrawal.status !== WithdrawalStatus.PROCESSING
    ) {
      throw new BadRequestException('withdrawal cannot be rejected');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tutorWallet.update({
        where: { id: withdrawal.walletId },
        data: {
          availableBalance: { increment: withdrawal.amount },
          withdrawnBalance: { decrement: withdrawal.amount },
        },
      });

      return tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.REJECTED,
          processedAt: new Date(),
          rejectionReason: reason,
        },
        include: adminWithdrawalInclude,
      });
    });

    await this.notifications.create(this.prisma, {
      userId: withdrawal.tutorProfile.userId,
      type: NotificationType.WITHDRAWAL_UPDATED,
      title: 'Yêu cầu rút tiền bị từ chối',
      body: reason,
      actionUrl: '/payments',
    });

    await this.prisma.adminAuditLog.create({
      data: {
        actorId: _admin.id,
        action: AdminAuditAction.WITHDRAWAL_REJECTED,
        resourceType: 'withdrawal',
        resourceId: id,
        reason,
      },
    });

    return this.serializeWithdrawal(updated);
  }

  async listAuditLogs() {
    const logs = await this.prisma.adminAuditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      reason: log.reason,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      actor: {
        id: log.actor.id,
        fullName: log.actor.fullName,
        email: log.actor.email,
      },
    }));
  }

  async listUsers(admin: AuthenticatedUser, role?: UserRole) {
    const take = 200;
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(role ? { role } : {}),
      },
      include: {
        _count: {
          select: {
            studentBookings: true,
            payerPayments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    await this.auditRead(admin, AdminAuditAction.USERS_VIEWED, 'user', {
      endpoint: 'GET /admin/users',
      filters: { role: role ?? null },
      take,
      resultCount: users.length,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      bookingCount: user._count.studentBookings,
      paymentCount: user._count.payerPayments,
    }));
  }

  async getSummary(admin: AuthenticatedUser) {
    const [
      totalUsers,
      students,
      tutors,
      admins,
      activeUsers,
      suspendedUsers,
      totalProfiles,
      approvedProfiles,
      pendingProfiles,
      rejectedProfiles,
      draftProfiles,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      paidPayments,
      pendingPayments,
      refundedPayments,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, role: UserRole.STUDENT },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, role: UserRole.TUTOR },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, status: UserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, status: UserStatus.SUSPENDED },
      }),
      this.prisma.tutorProfile.count({ where: { deletedAt: null } }),
      this.prisma.tutorProfile.count({
        where: {
          deletedAt: null,
          verificationStatus: TutorVerificationStatus.APPROVED,
        },
      }),
      this.prisma.tutorProfile.count({
        where: {
          deletedAt: null,
          verificationStatus: TutorVerificationStatus.PENDING_REVIEW,
        },
      }),
      this.prisma.tutorProfile.count({
        where: {
          deletedAt: null,
          verificationStatus: TutorVerificationStatus.REJECTED,
        },
      }),
      this.prisma.tutorProfile.count({
        where: {
          deletedAt: null,
          verificationStatus: TutorVerificationStatus.DRAFT,
        },
      }),
      this.prisma.booking.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: BookingStatus.CANCELLED },
      }),
      this.prisma.payment.findMany({ where: { status: PaymentStatus.PAID } }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PENDING },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.REFUNDED },
      }),
    ]);

    const sum = (
      items: Array<{
        amount: Prisma.Decimal;
        platformFeeAmount: Prisma.Decimal;
        tutorPayoutAmount: Prisma.Decimal;
      }>,
      field: 'amount' | 'platformFeeAmount' | 'tutorPayoutAmount',
    ) =>
      items.reduce(
        (total, item) => total.plus(item[field]),
        new Prisma.Decimal(0),
      );

    const summary = {
      users: {
        total: totalUsers,
        students,
        tutors,
        admins,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      tutors: {
        totalProfiles,
        approved: approvedProfiles,
        pendingReview: pendingProfiles,
        rejected: rejectedProfiles,
        draft: draftProfiles,
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      payments: {
        grossPaid: sum(paidPayments, 'amount').toString(),
        platformFees: sum(paidPayments, 'platformFeeAmount').toString(),
        tutorPayouts: sum(paidPayments, 'tutorPayoutAmount').toString(),
        heldPayouts: sum(
          paidPayments.filter(
            (payment) => payment.payoutStatus === PayoutStatus.HELD,
          ),
          'tutorPayoutAmount',
        ).toString(),
        releasedPayouts: sum(
          paidPayments.filter(
            (payment) => payment.payoutStatus === PayoutStatus.RELEASED,
          ),
          'tutorPayoutAmount',
        ).toString(),
        pendingAmount: sum(pendingPayments, 'amount').toString(),
        refundedAmount: sum(refundedPayments, 'amount').toString(),
        paidCount: paidPayments.length,
        pendingCount: pendingPayments.length,
        refundedCount: refundedPayments.length,
      },
    };

    await this.auditRead(admin, AdminAuditAction.SUMMARY_VIEWED, 'summary', {
      endpoint: 'GET /admin/summary',
    });

    return summary;
  }

  private async auditRead(
    actor: AuthenticatedUser,
    action: AdminAuditAction,
    resourceType: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        action,
        resourceType,
        resourceId: null,
        metadata: {
          ...metadata,
          viewedAt: new Date().toISOString(),
        },
      },
    });
  }

  private serializeBooking(booking: AdminBooking) {
    return {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      studentNote: booking.studentNote,
      cancellationReason: booking.cancellationReason,
      teachingMode: booking.teachingMode,
      createdAt: booking.createdAt.toISOString(),
      student: {
        id: booking.student.id,
        fullName: booking.student.fullName,
        email: booking.student.email,
      },
      tutor: {
        id: booking.tutorProfile.id,
        fullName: booking.tutorProfile.user.fullName,
        email: booking.tutorProfile.user.email,
        headline: booking.tutorProfile.headline,
        subjects: booking.tutorProfile.subjects.map((item) => ({
          id: item.id,
          level: item.level,
          subject: item.subject,
        })),
      },
      payment: booking.payment
        ? {
            id: booking.payment.id,
            amount: booking.payment.amount.toString(),
            platformFeeAmount: booking.payment.platformFeeAmount.toString(),
            tutorPayoutAmount: booking.payment.tutorPayoutAmount.toString(),
            currency: booking.payment.currency,
            provider: booking.payment.provider,
            status: booking.payment.status,
            payoutStatus: booking.payment.payoutStatus,
            paidAt: booking.payment.paidAt?.toISOString() ?? null,
            refundedAt: booking.payment.refundedAt?.toISOString() ?? null,
            revenueReleasedAt:
              booking.payment.revenueReleasedAt?.toISOString() ?? null,
            createdAt: booking.payment.createdAt.toISOString(),
          }
        : null,
    };
  }

  private serializePayment(payment: AdminPayment) {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount: payment.amount.toString(),
      platformFeeAmount: payment.platformFeeAmount.toString(),
      tutorPayoutAmount: payment.tutorPayoutAmount.toString(),
      currency: payment.currency,
      provider: payment.provider,
      status: payment.status,
      payoutStatus: payment.payoutStatus,
      providerTxnRef: payment.providerTxnRef,
      paidAt: payment.paidAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      refundReason: payment.refundReason,
      revenueReleasedAt: payment.revenueReleasedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      payer: {
        id: payment.payer.id,
        fullName: payment.payer.fullName,
        email: payment.payer.email,
      },
      student: {
        id: payment.booking.student.id,
        fullName: payment.booking.student.fullName,
        email: payment.booking.student.email,
      },
      tutor: {
        id: payment.booking.tutorProfile.id,
        fullName: payment.booking.tutorProfile.user.fullName,
        email: payment.booking.tutorProfile.user.email,
        headline: payment.booking.tutorProfile.headline,
      },
      booking: {
        id: payment.booking.id,
        status: payment.booking.status,
        startsAt: payment.booking.startsAt.toISOString(),
        endsAt: payment.booking.endsAt.toISOString(),
      },
    };
  }

  private serializeWithdrawal(withdrawal: AdminWithdrawal) {
    return {
      id: withdrawal.id,
      walletId: withdrawal.walletId,
      tutorProfileId: withdrawal.tutorProfileId,
      amount: withdrawal.amount.toString(),
      currency: withdrawal.currency,
      status: withdrawal.status,
      bankName: withdrawal.bankName,
      bankAccountNumber: withdrawal.bankAccountNumber,
      bankAccountName: withdrawal.bankAccountName,
      requestedAt: withdrawal.requestedAt.toISOString(),
      processedAt: withdrawal.processedAt?.toISOString() ?? null,
      rejectionReason: withdrawal.rejectionReason,
      tutor: {
        id: withdrawal.tutorProfile.id,
        fullName: withdrawal.tutorProfile.user.fullName,
        email: withdrawal.tutorProfile.user.email,
      },
    };
  }
}
