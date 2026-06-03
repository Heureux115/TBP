/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole, WithdrawalStatus } from '@prisma/client';
import { WalletService } from './wallet.service';

const tutor = {
  id: 'tutor-user-1',
  email: 'tutor@example.com',
  role: UserRole.TUTOR,
};
const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};

function createWallet(overrides: Partial<any> = {}) {
  return {
    id: 'wallet-1',
    tutorProfileId: 'tutor-profile-1',
    availableBalance: new Prisma.Decimal(170000),
    withdrawnBalance: new Prisma.Decimal(0),
    currency: 'VND',
    withdrawals: [],
    ...overrides,
  };
}

describe('WalletService', () => {
  it('creates a withdrawal by moving available balance into withdrawn balance', async () => {
    const wallet = createWallet();
    const updatedWallet = createWallet({
      availableBalance: new Prisma.Decimal(70000),
      withdrawnBalance: new Prisma.Decimal(100000),
      withdrawals: [
        {
          id: 'withdrawal-1',
          amount: new Prisma.Decimal(100000),
          currency: 'VND',
          status: WithdrawalStatus.PENDING,
          bankName: 'VCB',
          bankAccountNumber: '123',
          bankAccountName: 'Tutor',
          requestedAt: new Date('2026-06-01T05:00:00.000Z'),
          processedAt: null,
          rejectionReason: null,
        },
      ],
    });
    const tx = {
      tutorWallet: {
        upsert: jest.fn().mockResolvedValue(wallet),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedWallet),
      },
      withdrawal: { create: jest.fn() },
    };
    const prisma = {
      tutorProfile: {
        upsert: jest.fn().mockResolvedValue({ id: wallet.tutorProfileId }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new WalletService(prisma as any);

    const result = await service.createWithdrawal(tutor as any, {
      amount: 100000,
      bankName: ' VCB ',
      bankAccountNumber: ' 123 ',
      bankAccountName: ' Tutor ',
    });

    expect(tx.withdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(100000),
          bankName: 'VCB',
          bankAccountNumber: '123',
          bankAccountName: 'Tutor',
        }),
      }),
    );
    expect(tx.tutorWallet.update).toHaveBeenCalledWith({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: new Prisma.Decimal(100000) },
        withdrawnBalance: { increment: new Prisma.Decimal(100000) },
      },
    });
    expect(result.availableBalance).toBe('70000');
    expect(result.withdrawals[0].status).toBe(WithdrawalStatus.PENDING);
  });

  it('blocks withdrawal when balance is insufficient', async () => {
    const tx = {
      tutorWallet: {
        upsert: jest
          .fn()
          .mockResolvedValue(
            createWallet({ availableBalance: new Prisma.Decimal(1000) }),
          ),
      },
    };
    const service = new WalletService({
      tutorProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'tutor-profile-1' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any);

    await expect(
      service.createWithdrawal(tutor as any, {
        amount: 100000,
        bankName: 'VCB',
        bankAccountNumber: '123',
        bankAccountName: 'Tutor',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks students from tutor wallet', async () => {
    const service = new WalletService({} as any);

    await expect(service.getMine(student as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
