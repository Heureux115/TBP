import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  Prisma,
  TutorVerificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PrismaService } from '../prisma/prisma.service';
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
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateBookingDto) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can create bookings');
    }

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
        slot.tutorProfile.verificationStatus !== TutorVerificationStatus.APPROVED ||
        slot.tutorProfile.deletedAt ||
        slot.tutorProfile.user.status !== UserStatus.ACTIVE ||
        slot.tutorProfile.user.deletedAt
      ) {
        throw new BadRequestException('tutor is not available for booking');
      }

      if (slot.startsAt <= new Date()) {
        throw new BadRequestException('cannot book a past slot');
      }

      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      return tx.booking.create({
        data: {
          studentId: user.id,
          tutorProfileId: slot.tutorProfileId,
          availabilitySlotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          studentNote: dto.studentNote,
        },
        include: bookingInclude,
      });
    });

    return this.serializeBooking(booking);
  }

  async listMine(user: AuthenticatedUser) {
    const where: Prisma.BookingWhereInput =
      user.role === UserRole.TUTOR
        ? { tutorProfile: { userId: user.id } }
        : user.role === UserRole.STUDENT
          ? { studentId: user.id }
          : {};

    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('only students and tutors can view their bookings');
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

      return tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancellationReason: reason,
        },
        include: bookingInclude,
      });
    });

    return this.serializeBooking(updated);
  }

  private assertCanAccess(user: AuthenticatedUser, booking: BookingWithRelations) {
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
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
