/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  TeachingMode,
  TutorVerificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { BookingsService } from './bookings.service';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};
const tutor = {
  id: 'tutor-user-1',
  email: 'tutor@example.com',
  role: UserRole.TUTOR,
};

function createBooking(overrides: Partial<any> = {}) {
  return {
    id: 'booking-1',
    studentId: student.id,
    tutorProfileId: 'tutor-profile-1',
    availabilitySlotId: 'slot-1',
    status: BookingStatus.CONFIRMED,
    startsAt: new Date('2026-06-01T03:00:00.000Z'),
    endsAt: new Date('2026-06-01T04:00:00.000Z'),
    studentNote: null,
    cancellationReason: null,
    hourlyRateSnapshot: new Prisma.Decimal(200000),
    grossAmountSnapshot: new Prisma.Decimal(200000),
    teachingMode: TeachingMode.ONLINE,
    createdAt: new Date('2026-05-31T03:00:00.000Z'),
    student: { id: student.id, fullName: 'Student', email: student.email },
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: tutor.id,
      headline: 'Math',
      avatarUrl: null,
      subjects: [],
      user: { id: tutor.id, fullName: 'Tutor', email: tutor.email },
    },
    availabilitySlot: { id: 'slot-1' },
    payment: null,
    ...overrides,
  };
}

function createPaidPayment(overrides: Partial<any> = {}) {
  return {
    id: 'payment-1',
    amount: new Prisma.Decimal(200000),
    platformFeeAmount: new Prisma.Decimal(30000),
    tutorPayoutAmount: new Prisma.Decimal(170000),
    currency: 'VND',
    status: PaymentStatus.PAID,
    payoutStatus: PayoutStatus.HELD,
    paidAt: new Date('2026-06-01T02:50:00.000Z'),
    refundedAt: null,
    refundReason: null,
    revenueReleasedAt: null,
    ...overrides,
  };
}

function createNotificationsMock() {
  return {
    create: jest.fn(),
    createMany: jest.fn(),
  };
}

describe('BookingsService', () => {
  it('creates a student booking, books the slot, snapshots gross amount, and notifies tutor', async () => {
    const slot = {
      id: 'slot-1',
      tutorProfileId: 'tutor-profile-1',
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 90_000_000),
      isBooked: false,
      deletedAt: null,
      tutorProfile: {
        id: 'tutor-profile-1',
        userId: tutor.id,
        hourlyRate: new Prisma.Decimal(200000),
        teachingMode: TeachingMode.BOTH,
        verificationStatus: TutorVerificationStatus.APPROVED,
        deletedAt: null,
        user: {
          id: tutor.id,
          fullName: 'Tutor',
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
    };
    const created = createBooking({
      status: BookingStatus.PENDING,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      grossAmountSnapshot: new Prisma.Decimal(200000),
      teachingMode: TeachingMode.OFFLINE,
    });
    const tx = {
      availabilitySlot: {
        findUnique: jest.fn().mockResolvedValue(slot),
        update: jest.fn(),
      },
      booking: { create: jest.fn().mockResolvedValue(created) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const notifications = createNotificationsMock();
    const service = new BookingsService(prisma as any, notifications as any);

    const result = await service.create(student as any, {
      availabilitySlotId: slot.id,
      teachingMode: TeachingMode.OFFLINE,
    });

    expect(tx.availabilitySlot.update).toHaveBeenCalledWith({
      where: { id: slot.id },
      data: { isBooked: true },
    });
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: student.id,
          teachingMode: TeachingMode.OFFLINE,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: tutor.id,
        type: NotificationType.BOOKING_REQUESTED,
      }),
    );
    expect(result.teachingMode).toBe(TeachingMode.OFFLINE);
  });

  it('blocks booking without choosing online/offline when tutor supports both', async () => {
    const slot = {
      id: 'slot-1',
      isBooked: false,
      deletedAt: null,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 90_000_000),
      tutorProfile: {
        verificationStatus: TutorVerificationStatus.APPROVED,
        deletedAt: null,
        teachingMode: TeachingMode.BOTH,
        hourlyRate: new Prisma.Decimal(200000),
        user: { status: UserStatus.ACTIVE, deletedAt: null },
      },
    };
    const tx = {
      availabilitySlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    };
    const service = new BookingsService(
      { $transaction: jest.fn((callback) => callback(tx)) } as any,
      createNotificationsMock() as any,
    );

    await expect(
      service.create(student as any, { availabilitySlotId: slot.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the assigned tutor confirm a pending booking and notifies the student', async () => {
    const booking = createBooking({
      status: BookingStatus.PENDING,
      startsAt: new Date(Date.now() + 86_400_000),
    });
    const confirmed = createBooking({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });
    const tx = { booking: { update: jest.fn().mockResolvedValue(confirmed) } };
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = createNotificationsMock();
    const service = new BookingsService(prisma as any, notifications as any);

    const result = await service.confirm(tutor as any, booking.id);

    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: student.id,
        type: NotificationType.BOOKING_CONFIRMED,
      }),
    );
  });

  it('completes a paid booking by releasing payout to tutor wallet', async () => {
    const booking = createBooking({
      startsAt: new Date(Date.now() - 60_000),
      payment: createPaidPayment(),
    });
    const completed = createBooking({
      ...booking,
      status: BookingStatus.COMPLETED,
    });
    const tx = {
      payment: { update: jest.fn() },
      tutorWallet: { upsert: jest.fn() },
      booking: { update: jest.fn().mockResolvedValue(completed) },
    };
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = createNotificationsMock();
    const service = new BookingsService(prisma as any, notifications as any);

    const result = await service.complete(tutor as any, booking.id);

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ payoutStatus: PayoutStatus.RELEASED }),
      }),
    );
    expect(tx.tutorWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          availableBalance: { increment: booking.payment.tutorPayoutAmount },
        },
      }),
    );
    expect(result.status).toBe(BookingStatus.COMPLETED);
  });

  it('blocks students from completing tutor bookings', async () => {
    const booking = createBooking({ payment: createPaidPayment() });
    const service = new BookingsService(
      { booking: { findFirst: jest.fn().mockResolvedValue(booking) } } as any,
      createNotificationsMock() as any,
    );

    await expect(
      service.complete(student as any, booking.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
