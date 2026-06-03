import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { calculatePaymentSplit } from './payment-policy';

const paymentInclude = {
  booking: {
    include: {
      student: true,
      tutorProfile: {
        include: {
          user: true,
        },
      },
    },
  },
  payer: true,
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreatePaymentDto) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can pay for bookings');
    }

    if (dto.provider !== PaymentProvider.MOCK) {
      throw new BadRequestException(
        'payment provider is not configured for this environment',
      );
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: dto.bookingId,
        studentId: user.id,
        deletedAt: null,
      },
      include: {
        tutorProfile: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'booking must be confirmed by the tutor before payment',
      );
    }

    const amount = booking.grossAmountSnapshot.gt(0)
      ? booking.grossAmountSnapshot
      : (booking.tutorProfile.hourlyRate ?? new Prisma.Decimal(0));

    if (amount.lte(0)) {
      throw new BadRequestException('booking has no payable amount');
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { bookingId: booking.id },
      include: paymentInclude,
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.PENDING) {
        return this.serialize(existingPayment);
      }

      if (existingPayment.status === PaymentStatus.PAID) {
        throw new BadRequestException('booking is already paid');
      }

      throw new BadRequestException('booking payment cannot be restarted');
    }

    const split = calculatePaymentSplit(amount);
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        payerId: user.id,
        amount,
        platformFeeAmount: split.platformFeeAmount,
        tutorPayoutAmount: split.tutorPayoutAmount,
        provider: dto.provider,
        status: PaymentStatus.PENDING,
        payoutStatus: PayoutStatus.HELD,
        providerTxnRef: `MOCK-${randomUUID()}`,
        checkoutUrl: `/dashboard?payment=mock&bookingId=${booking.id}`,
      },
      include: paymentInclude,
    });

    return this.serialize(payment);
  }

  async listMine(user: AuthenticatedUser) {
    const where: Prisma.PaymentWhereInput =
      user.role === UserRole.STUDENT
        ? { payerId: user.id }
        : user.role === UserRole.TUTOR
          ? { booking: { tutorProfile: { userId: user.id } } }
          : {};

    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TUTOR) {
      throw new ForbiddenException(
        'only students and tutors can view payments',
      );
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((payment) => this.serialize(payment));
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: paymentInclude,
    });

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    const canView =
      payment.payerId === user.id ||
      payment.booking.tutorProfile.userId === user.id;

    if (!canView) {
      throw new ForbiddenException('payment access denied');
    }

    return this.serialize(payment);
  }

  async mockConfirm(user: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        payerId: user.id,
      },
      include: paymentInclude,
    });

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    if (payment.status === PaymentStatus.PAID) {
      return this.serialize(payment);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('payment cannot be confirmed');
    }

    if (
      payment.booking.status !== BookingStatus.CONFIRMED ||
      payment.booking.deletedAt
    ) {
      throw new BadRequestException('booking is not payable');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: { id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.PAID,
          payoutStatus: PayoutStatus.HELD,
          paidAt: new Date(),
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new BadRequestException('payment cannot be confirmed');
      }

      const updatedPayment = await tx.payment.findUniqueOrThrow({
        where: { id },
        include: paymentInclude,
      });

      await this.notifications.createMany(tx, [
        {
          userId: updatedPayment.booking.studentId,
          type: NotificationType.PAYMENT_PAID,
          title: 'Thanh toán thành công',
          body: `Bạn đã thanh toán ${updatedPayment.amount.toString()} ${updatedPayment.currency} cho buổi học.`,
          actionUrl: `/payments/${updatedPayment.id}`,
        },
        {
          userId: updatedPayment.booking.tutorProfile.userId,
          type: NotificationType.PAYMENT_PAID,
          title: 'Học viên đã thanh toán',
          body: `${updatedPayment.payer.fullName} đã thanh toán cho buổi học sắp tới.`,
          actionUrl: `/bookings/${updatedPayment.bookingId}`,
        },
      ]);

      return updatedPayment;
    });

    return this.serialize(updated);
  }

  private serialize(payment: PaymentWithRelations) {
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
      checkoutUrl: payment.checkoutUrl,
      providerTxnRef: payment.providerTxnRef,
      paidAt: payment.paidAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      refundReason: payment.refundReason,
      revenueReleasedAt: payment.revenueReleasedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      booking: {
        id: payment.booking.id,
        startsAt: payment.booking.startsAt.toISOString(),
        endsAt: payment.booking.endsAt.toISOString(),
        status: payment.booking.status,
      },
      tutor: {
        id: payment.booking.tutorProfile.id,
        fullName: payment.booking.tutorProfile.user.fullName,
      },
      payer: {
        id: payment.payer.id,
        fullName: payment.payer.fullName,
      },
    };
  }
}
