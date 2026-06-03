/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};
const tutorUser = {
  id: 'tutor-user-1',
  fullName: 'Tutor',
  email: 'tutor@example.com',
};

function createBooking(overrides: Partial<any> = {}) {
  return {
    id: 'booking-1',
    studentId: student.id,
    status: BookingStatus.CONFIRMED,
    deletedAt: null,
    startsAt: new Date('2026-06-01T03:00:00.000Z'),
    endsAt: new Date('2026-06-01T04:00:00.000Z'),
    grossAmountSnapshot: new Prisma.Decimal(200000),
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: tutorUser.id,
      hourlyRate: new Prisma.Decimal(200000),
      user: tutorUser,
    },
    ...overrides,
  };
}

function createPayment(overrides: Partial<any> = {}) {
  const booking = createBooking();
  return {
    id: 'payment-1',
    bookingId: booking.id,
    payerId: student.id,
    amount: new Prisma.Decimal(200000),
    platformFeeAmount: new Prisma.Decimal(30000),
    tutorPayoutAmount: new Prisma.Decimal(170000),
    currency: 'VND',
    provider: PaymentProvider.MOCK,
    status: PaymentStatus.PENDING,
    payoutStatus: PayoutStatus.HELD,
    providerTxnRef: 'MOCK-1',
    checkoutUrl: '/dashboard?payment=mock&bookingId=booking-1',
    paidAt: null,
    refundedAt: null,
    refundReason: null,
    revenueReleasedAt: null,
    createdAt: new Date('2026-06-01T02:50:00.000Z'),
    payer: { id: student.id, fullName: 'Student' },
    booking: {
      ...booking,
      studentId: student.id,
      tutorProfile: { ...booking.tutorProfile, user: tutorUser },
    },
    ...overrides,
  };
}

function notificationsMock() {
  return { createMany: jest.fn() };
}

describe('PaymentsService', () => {
  it('creates one pending payment for a confirmed student booking with 15/85 split', async () => {
    const booking = createBooking();
    const payment = createPayment({ booking });
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(payment),
      },
    };
    const service = new PaymentsService(
      prisma as any,
      notificationsMock() as any,
    );

    const result = await service.create(student as any, {
      bookingId: booking.id,
      provider: PaymentProvider.MOCK,
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: booking.grossAmountSnapshot,
          platformFeeAmount: new Prisma.Decimal(30000),
          tutorPayoutAmount: new Prisma.Decimal(170000),
          status: PaymentStatus.PENDING,
          payoutStatus: PayoutStatus.HELD,
        }),
      }),
    );
    expect(result.status).toBe(PaymentStatus.PENDING);
  });

  it('blocks payment before tutor confirms booking', async () => {
    const booking = createBooking({ status: BookingStatus.PENDING });
    const service = new PaymentsService(
      { booking: { findFirst: jest.fn().mockResolvedValue(booking) } } as any,
      notificationsMock() as any,
    );

    await expect(
      service.create(student as any, {
        bookingId: booking.id,
        provider: PaymentProvider.MOCK,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mock confirms a pending payment and notifies both student and tutor', async () => {
    const payment = createPayment();
    const paidPayment = createPayment({
      status: PaymentStatus.PAID,
      paidAt: new Date('2026-06-01T02:55:00.000Z'),
    });
    const tx = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(paidPayment),
      },
    };
    const prisma = {
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = notificationsMock();
    const service = new PaymentsService(prisma as any, notifications as any);

    const result = await service.mockConfirm(student as any, payment.id);

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          payoutStatus: PayoutStatus.HELD,
        }),
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining([
        expect.objectContaining({
          userId: student.id,
          type: NotificationType.PAYMENT_PAID,
        }),
        expect.objectContaining({
          userId: tutorUser.id,
          type: NotificationType.PAYMENT_PAID,
        }),
      ]),
    );
    expect(result.status).toBe(PaymentStatus.PAID);
  });
});
