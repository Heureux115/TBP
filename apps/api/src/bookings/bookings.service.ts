import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  TeachingMode,
  NotificationType,
  TutorVerificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { calculateBookingGrossAmount } from '../payments/payment-policy';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const bookingInclude = {
  student: true,
  tutorProfile: {
    include: {
      user: true,
      subjects: {
        include: { subject: true },
      },
    },
  },
  availabilitySlot: true,
  payment: true,
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateBookingDto) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can create bookings');
    }

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: dto.availabilitySlotId },
        include: {
          tutorProfile: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!slot || slot.deletedAt) {
        throw new NotFoundException('availability slot not found');
      }

      if (slot.isBooked) {
        throw new BadRequestException('availability slot is already booked');
      }

      if (
        slot.tutorProfile.verificationStatus !==
          TutorVerificationStatus.APPROVED ||
        slot.tutorProfile.deletedAt ||
        slot.tutorProfile.user.status !== UserStatus.ACTIVE ||
        slot.tutorProfile.user.deletedAt
      ) {
        throw new BadRequestException('tutor is not available for booking');
      }

      if (slot.startsAt <= new Date()) {
        throw new BadRequestException('cannot book a past slot');
      }

      const hourlyRateSnapshot =
        slot.tutorProfile.hourlyRate ?? new Prisma.Decimal(0);
      const teachingMode = this.resolveBookingTeachingMode(
        slot.tutorProfile.teachingMode,
        dto.teachingMode,
      );

      const reserved = await tx.availabilitySlot.updateMany({
        where: { id: slot.id, isBooked: false, deletedAt: null },
        data: { isBooked: true },
      });

      if (reserved.count !== 1) {
        throw new BadRequestException('availability slot is already booked');
      }

      const created = await tx.booking.create({
        data: {
          studentId: user.id,
          tutorProfileId: slot.tutorProfileId,
          availabilitySlotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          hourlyRateSnapshot,
          grossAmountSnapshot: calculateBookingGrossAmount(
            hourlyRateSnapshot,
            slot.startsAt,
            slot.endsAt,
          ),
          teachingMode,
          studentNote: dto.studentNote,
        },
        include: bookingInclude,
      });

      await this.notifications.create(tx, {
        userId: slot.tutorProfile.userId,
        type: NotificationType.BOOKING_REQUESTED,
        title: 'Có yêu cầu đặt lịch mới',
        body: `${created.student.fullName} đã đặt lịch ${created.startsAt.toLocaleString('vi-VN')}.`,
        actionUrl: `/bookings/${created.id}`,
      });

      return created;
      });

      return this.serializeBooking(booking);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('availability slot is already booked');
      }

      throw error;
    }
  }

  async listMine(user: AuthenticatedUser) {
    const where: Prisma.BookingWhereInput =
      user.role === UserRole.TUTOR
        ? { tutorProfile: { userId: user.id } }
        : user.role === UserRole.STUDENT
          ? { studentId: user.id }
          : {};

    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TUTOR) {
      throw new ForbiddenException(
        'only students and tutors can view their bookings',
      );
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      include: bookingInclude,
      orderBy: { startsAt: 'asc' },
    });

    return bookings.map((booking) => this.serializeBooking(booking));
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    this.assertCanAccess(user, booking);

    return this.serializeBooking(booking);
  }

  async cancel(user: AuthenticatedUser, id: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    this.assertCanAccess(user, booking);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException('booking cannot be cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.update({
        where: { id: booking.availabilitySlotId },
        data: { isBooked: false },
      });

      if (booking.payment?.status === PaymentStatus.PAID) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            payoutStatus: PayoutStatus.REFUNDED,
            refundedAt: new Date(),
            refundReason: reason ?? 'booking cancelled before completion',
          },
        });
      } else if (booking.payment?.status === PaymentStatus.PENDING) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: PaymentStatus.CANCELLED,
            payoutStatus: PayoutStatus.CANCELLED,
          },
        });
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancellationReason: reason,
        },
        include: bookingInclude,
      });

      await this.notifications.createMany(tx, [
        {
          userId: booking.studentId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Lịch học đã bị hủy',
          body: `Lịch học với ${booking.tutorProfile.user.fullName} đã bị hủy.`,
          actionUrl: `/bookings/${booking.id}`,
        },
        {
          userId: booking.tutorProfile.userId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Lịch dạy đã bị hủy',
          body: `Lịch dạy với ${booking.student.fullName} đã bị hủy.`,
          actionUrl: `/bookings/${booking.id}`,
        },
      ]);

      return updatedBooking;
    });

    return this.serializeBooking(updated);
  }

  async confirm(user: AuthenticatedUser, id: string) {
    if (user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('only tutors can confirm bookings');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (booking.tutorProfile.userId !== user.id) {
      throw new ForbiddenException('booking access denied');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('only pending bookings can be confirmed');
    }

    if (booking.startsAt <= new Date()) {
      throw new BadRequestException('cannot confirm a past booking');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CONFIRMED },
        include: bookingInclude,
      });

      await this.notifications.create(tx, {
        userId: booking.studentId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Gia sư đã xác nhận lịch',
        body: `${booking.tutorProfile.user.fullName} đã xác nhận lịch học. Bạn có thể thanh toán.`,
        actionUrl: `/bookings/${booking.id}`,
      });

      return updatedBooking;
    });

    return this.serializeBooking(updated);
  }

  async complete(user: AuthenticatedUser, id: string) {
    if (user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('only tutors can complete bookings');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (booking.tutorProfile.userId !== user.id) {
      throw new ForbiddenException(
        'only the assigned tutor can complete bookings',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('only confirmed bookings can be completed');
    }

    if (booking.startsAt > new Date()) {
      throw new BadRequestException(
        'booking cannot be completed before it starts',
      );
    }

    if (!booking.payment || booking.payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('booking must be paid before completion');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: booking.payment!.id },
        data: {
          payoutStatus: PayoutStatus.RELEASED,
          revenueReleasedAt: new Date(),
        },
      });

      await tx.tutorWallet.upsert({
        where: { tutorProfileId: booking.tutorProfileId },
        create: {
          tutorProfileId: booking.tutorProfileId,
          availableBalance: booking.payment!.tutorPayoutAmount,
          currency: booking.payment!.currency,
        },
        update: {
          availableBalance: {
            increment: booking.payment!.tutorPayoutAmount,
          },
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.COMPLETED },
        include: bookingInclude,
      });

      await this.notifications.createMany(tx, [
        {
          userId: booking.studentId,
          type: NotificationType.BOOKING_COMPLETED,
          title: 'Buổi học đã hoàn thành',
          body: `Buổi học với ${booking.tutorProfile.user.fullName} đã hoàn thành. Bạn có thể gửi đánh giá.`,
          actionUrl: `/tutors/${booking.tutorProfileId}`,
        },
        {
          userId: booking.tutorProfile.userId,
          type: NotificationType.BOOKING_COMPLETED,
          title: 'Doanh thu đã được ghi nhận',
          body: `Hệ thống đã mở khóa payout cho buổi học với ${booking.student.fullName}.`,
          actionUrl: '/payments',
        },
      ]);

      return updatedBooking;
    });

    return this.serializeBooking(updated);
  }

  private assertCanAccess(
    user: AuthenticatedUser,
    booking: BookingWithRelations,
  ) {
    const isStudentOwner = booking.studentId === user.id;
    const isTutorOwner = booking.tutorProfile.userId === user.id;

    if (!isStudentOwner && !isTutorOwner) {
      throw new ForbiddenException('booking access denied');
    }
  }

  private serializeBooking(booking: BookingWithRelations) {
    return {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      studentNote: booking.studentNote,
      cancellationReason: booking.cancellationReason,
      hourlyRateSnapshot: booking.hourlyRateSnapshot.toString(),
      grossAmountSnapshot: booking.grossAmountSnapshot.toString(),
      teachingMode: booking.teachingMode,
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
        avatarUrl: booking.tutorProfile.avatarUrl,
        subjects: booking.tutorProfile.subjects.map((item) => ({
          id: item.id,
          level: item.level,
          subject: item.subject,
        })),
      },
      availabilitySlotId: booking.availabilitySlotId,
      payment: booking.payment
        ? {
            id: booking.payment.id,
            amount: booking.payment.amount.toString(),
            platformFeeAmount: booking.payment.platformFeeAmount.toString(),
            tutorPayoutAmount: booking.payment.tutorPayoutAmount.toString(),
            currency: booking.payment.currency,
            status: booking.payment.status,
            payoutStatus: booking.payment.payoutStatus,
            paidAt: booking.payment.paidAt?.toISOString() ?? null,
            refundedAt: booking.payment.refundedAt?.toISOString() ?? null,
            refundReason: booking.payment.refundReason,
            revenueReleasedAt:
              booking.payment.revenueReleasedAt?.toISOString() ?? null,
          }
        : null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private resolveBookingTeachingMode(
    tutorMode: TeachingMode,
    requestedMode?: TeachingMode,
  ) {
    if (
      tutorMode === TeachingMode.ONLINE ||
      tutorMode === TeachingMode.OFFLINE
    ) {
      if (requestedMode && requestedMode !== tutorMode) {
        throw new BadRequestException(
          `tutor only supports ${tutorMode.toLowerCase()} lessons`,
        );
      }

      return tutorMode;
    }

    if (!requestedMode || requestedMode === TeachingMode.BOTH) {
      throw new BadRequestException(
        'please choose ONLINE or OFFLINE lesson mode',
      );
    }

    return requestedMode;
  }
}
