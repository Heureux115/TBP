/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  UserRole,
  UserStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { AdminOperationsService } from './admin-operations.service';

const admin = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

function createPayment(overrides: Partial<any> = {}) {
  const booking = {
    id: 'booking-1',
    availabilitySlotId: 'slot-1',
    status: BookingStatus.CONFIRMED,
    startsAt: new Date('2026-06-01T03:00:00.000Z'),
    endsAt: new Date('2026-06-01T04:00:00.000Z'),
    tutorProfileId: 'tutor-profile-1',
    student: {
      id: 'student-1',
      fullName: 'Student',
      email: 'student@example.com',
    },
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: 'tutor-user-1',
      headline: 'Math',
      user: {
        id: 'tutor-user-1',
        fullName: 'Tutor',
        email: 'tutor@example.com',
      },
      subjects: [],
    },
  };

  return {
    id: 'payment-1',
    bookingId: booking.id,
    payerId: 'student-1',
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
    payer: {
      id: 'student-1',
      fullName: 'Student',
      email: 'student@example.com',
    },
    booking,
    ...overrides,
  };
}

function createWithdrawal(overrides: Partial<any> = {}) {
  return {
    id: 'withdrawal-1',
    walletId: 'wallet-1',
    tutorProfileId: 'tutor-profile-1',
    amount: new Prisma.Decimal(170000),
    currency: 'VND',
    status: WithdrawalStatus.PENDING,
    bankName: 'VCB',
    bankAccountNumber: '123',
    bankAccountName: 'Tutor',
    requestedAt: new Date('2026-06-01T05:00:00.000Z'),
    processedAt: null,
    rejectionReason: null,
    wallet: {
      id: 'wallet-1',
      tutorProfileId: 'tutor-profile-1',
      availableBalance: new Prisma.Decimal(0),
      withdrawnBalance: new Prisma.Decimal(170000),
      currency: 'VND',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: 'tutor-user-1',
      user: {
        id: 'tutor-user-1',
        fullName: 'Tutor',
        email: 'tutor@example.com',
        status: UserStatus.ACTIVE,
      },
    },
    ...overrides,
  };
}

describe('AdminOperationsService', () => {
  it('refunds a held paid payment and cancels the active booking', async () => {
    const payment = createPayment();
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...payment,
          status: PaymentStatus.REFUNDED,
          payoutStatus: PayoutStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: 'student dispute',
          booking: {
            ...payment.booking,
            status: BookingStatus.CANCELLED,
          },
        }),
      },
      booking: { update: jest.fn() },
      availabilitySlot: { update: jest.fn() },
      tutorWallet: { findUnique: jest.fn(), update: jest.fn() },
      adminAuditLog: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const service = new AdminOperationsService(prisma, {
      create: jest.fn(),
    } as any);

    const result = await service.refundPayment(
      admin,
      payment.id,
      'student dispute',
    );

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payment.id },
        data: expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          payoutStatus: PayoutStatus.REFUNDED,
          refundReason: 'student dispute',
        }),
      }),
    );
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
      }),
    );
    expect(prisma.availabilitySlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isBooked: false } }),
    );
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('rejects a withdrawal and returns the held amount to tutor wallet', async () => {
    const withdrawal = createWithdrawal();
    const prisma = {
      withdrawal: {
        findUnique: jest.fn().mockResolvedValue(withdrawal),
        update: jest.fn().mockResolvedValue({
          ...withdrawal,
          status: WithdrawalStatus.REJECTED,
          rejectionReason: 'invalid bank account',
          processedAt: new Date(),
        }),
      },
      tutorWallet: { update: jest.fn() },
      adminAuditLog: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const service = new AdminOperationsService(prisma, {
      create: jest.fn(),
    } as any);

    const result = await service.rejectWithdrawal(
      admin,
      withdrawal.id,
      'invalid bank account',
    );

    expect(prisma.tutorWallet.update).toHaveBeenCalledWith({
      where: { id: withdrawal.walletId },
      data: {
        availableBalance: { increment: withdrawal.amount },
        withdrawnBalance: { decrement: withdrawal.amount },
      },
    });
    expect(result.status).toBe(WithdrawalStatus.REJECTED);
    expect(result.rejectionReason).toBe('invalid bank account');
  });

  it('blocks refund after released payout when tutor wallet cannot cover it', async () => {
    const payment = createPayment({ payoutStatus: PayoutStatus.RELEASED });
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      tutorWallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          availableBalance: new Prisma.Decimal(1000),
        }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const service = new AdminOperationsService(prisma, {
      create: jest.fn(),
    } as any);

    await expect(
      service.refundPayment(admin, payment.id, 'late dispute'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
