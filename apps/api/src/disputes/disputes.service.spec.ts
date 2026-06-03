/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  DisputeStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { DisputesService } from './disputes.service';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
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
    student: {
      id: student.id,
      fullName: 'Student',
      email: student.email,
    },
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: 'tutor-user-1',
      user: {
        id: 'tutor-user-1',
        fullName: 'Tutor',
        email: 'tutor@example.com',
      },
    },
    payment: createPayment(),
    ...overrides,
  };
}

function createPayment(overrides: Partial<any> = {}) {
  return {
    id: 'payment-1',
    bookingId: 'booking-1',
    payerId: student.id,
    amount: new Prisma.Decimal(200000),
    platformFeeAmount: new Prisma.Decimal(30000),
    tutorPayoutAmount: new Prisma.Decimal(170000),
    currency: 'VND',
    provider: PaymentProvider.MOCK,
    status: PaymentStatus.PAID,
    payoutStatus: PayoutStatus.HELD,
    providerTxnRef: 'MOCK-1',
    checkoutUrl: null,
    paidAt: new Date('2026-06-01T02:55:00.000Z'),
    refundedAt: null,
    refundReason: null,
    revenueReleasedAt: null,
    createdAt: new Date('2026-06-01T02:50:00.000Z'),
    updatedAt: new Date('2026-06-01T02:50:00.000Z'),
    ...overrides,
  };
}

function createDispute(overrides: Partial<any> = {}) {
  const booking = createBooking(overrides.booking);
  return {
    id: 'dispute-1',
    bookingId: booking.id,
    paymentId: booking.payment.id,
    openedById: student.id,
    resolvedById: null,
    status: DisputeStatus.OPEN,
    reason: 'Tutor did not attend the lesson',
    adminNote: null,
    resolution: null,
    createdAt: new Date('2026-06-01T04:10:00.000Z'),
    updatedAt: new Date('2026-06-01T04:10:00.000Z'),
    resolvedAt: null,
    openedBy: booking.student,
    resolvedBy: null,
    booking,
    payment: booking.payment,
    ...overrides,
  };
}

function createNotificationsMock() {
  return {
    create: jest.fn(),
    createMany: jest.fn(),
  };
}

describe('DisputesService', () => {
  it('lets a student open one dispute for a paid booking and notifies admins and tutor', async () => {
    const booking = createBooking();
    const dispute = createDispute({ booking });
    const tx = {
      dispute: { create: jest.fn().mockResolvedValue(dispute) },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'admin-1' }, { id: 'super-admin-1' }]),
      },
    };
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      dispute: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = createNotificationsMock();
    const service = new DisputesService(prisma as any, notifications as any);

    const result = await service.create(student as any, {
      bookingId: booking.id,
      reason: '  Tutor did not attend the lesson  ',
    });

    expect(tx.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: booking.id,
          paymentId: booking.payment.id,
          openedById: student.id,
          reason: 'Tutor did not attend the lesson',
        }),
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'admin-1',
          type: NotificationType.DISPUTE_UPDATED,
        }),
      ]),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: booking.tutorProfile.userId,
        type: NotificationType.DISPUTE_UPDATED,
      }),
    );
    expect(result.status).toBe(DisputeStatus.OPEN);
  });

  it('blocks disputes for unpaid bookings', async () => {
    const booking = createBooking({
      payment: createPayment({ status: PaymentStatus.PENDING }),
    });
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
    };
    const service = new DisputesService(
      prisma as any,
      createNotificationsMock() as any,
    );

    await expect(
      service.create(student as any, {
        bookingId: booking.id,
        reason: 'Tutor did not attend the lesson',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves a held paid dispute by refunding payment, cancelling booking, freeing slot, and auditing', async () => {
    const dispute = createDispute();
    const refundedDispute = createDispute({
      status: DisputeStatus.RESOLVED_REFUNDED,
      resolvedById: admin.id,
      resolvedAt: new Date('2026-06-01T05:00:00.000Z'),
      adminNote: 'refund approved',
      resolution: 'Refunded by admin',
      payment: createPayment({
        status: PaymentStatus.REFUNDED,
        payoutStatus: PayoutStatus.REFUNDED,
        refundedAt: new Date('2026-06-01T05:00:00.000Z'),
      }),
    });
    const tx = {
      payment: { update: jest.fn() },
      booking: { update: jest.fn() },
      availabilitySlot: { update: jest.fn() },
      dispute: { update: jest.fn().mockResolvedValue(refundedDispute) },
      adminAuditLog: { create: jest.fn() },
    };
    const prisma = {
      dispute: { findUnique: jest.fn().mockResolvedValue(dispute) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = createNotificationsMock();
    const service = new DisputesService(prisma as any, notifications as any);

    const result = await service.resolveRefunded(
      admin as any,
      dispute.id,
      'refund approved',
    );

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dispute.paymentId },
        data: expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          payoutStatus: PayoutStatus.REFUNDED,
          refundReason: 'refund approved',
        }),
      }),
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dispute.bookingId },
        data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
      }),
    );
    expect(tx.availabilitySlot.update).toHaveBeenCalledWith({
      where: { id: dispute.booking.availabilitySlotId },
      data: { isBooked: false },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalled();
    expect(notifications.createMany).toHaveBeenCalled();
    expect(result.status).toBe(DisputeStatus.RESOLVED_REFUNDED);
  });

  it('blocks dispute refund after released payout when tutor wallet cannot cover it', async () => {
    const dispute = createDispute({
      payment: createPayment({ payoutStatus: PayoutStatus.RELEASED }),
    });
    const tx = {
      tutorWallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          availableBalance: new Prisma.Decimal(1000),
        }),
      },
    };
    const prisma = {
      dispute: { findUnique: jest.fn().mockResolvedValue(dispute) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new DisputesService(
      prisma as any,
      createNotificationsMock() as any,
    );

    await expect(
      service.resolveRefunded(admin as any, dispute.id, 'refund approved'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
