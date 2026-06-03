import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(user: AuthenticatedUser) {
    const profile = await this.getTutorProfile(user);
    const wallet = await this.prisma.tutorWallet.upsert({
      where: { tutorProfileId: profile.id },
      create: { tutorProfileId: profile.id },
      update: {},
      include: {
        withdrawals: {
          orderBy: { requestedAt: 'desc' },
          take: 10,
        },
      },
    });

    return this.serializeWallet(wallet);
  }

  async createWithdrawal(user: AuthenticatedUser, dto: CreateWithdrawalDto) {
    const profile = await this.getTutorProfile(user);
    const amount = new Prisma.Decimal(dto.amount);

    if (amount.lte(0)) {
      throw new BadRequestException(
        'withdrawal amount must be greater than zero',
      );
    }

    const wallet = await this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.tutorWallet.upsert({
        where: { tutorProfileId: profile.id },
        create: { tutorProfileId: profile.id },
        update: {},
      });

      if (currentWallet.availableBalance.lt(amount)) {
        throw new BadRequestException('insufficient wallet balance');
      }

      await tx.withdrawal.create({
        data: {
          walletId: currentWallet.id,
          tutorProfileId: profile.id,
          amount,
          currency: currentWallet.currency,
          bankName: dto.bankName.trim(),
          bankAccountNumber: dto.bankAccountNumber.trim(),
          bankAccountName: dto.bankAccountName.trim(),
        },
      });

      await tx.tutorWallet.update({
        where: { id: currentWallet.id },
        data: {
          availableBalance: { decrement: amount },
          withdrawnBalance: { increment: amount },
        },
      });

      return tx.tutorWallet.findUniqueOrThrow({
        where: { id: currentWallet.id },
        include: {
          withdrawals: {
            orderBy: { requestedAt: 'desc' },
            take: 10,
          },
        },
      });
    });

    return this.serializeWallet(wallet);
  }

  private async getTutorProfile(user: AuthenticatedUser) {
    if (user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('tutor role required');
    }

    return this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });
  }

  private serializeWallet(
    wallet: Prisma.TutorWalletGetPayload<{
      include: { withdrawals: true };
    }>,
  ) {
    return {
      id: wallet.id,
      tutorProfileId: wallet.tutorProfileId,
      availableBalance: wallet.availableBalance.toString(),
      withdrawnBalance: wallet.withdrawnBalance.toString(),
      currency: wallet.currency,
      withdrawals: wallet.withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        amount: withdrawal.amount.toString(),
        currency: withdrawal.currency,
        status: withdrawal.status,
        bankName: withdrawal.bankName,
        bankAccountNumber: withdrawal.bankAccountNumber,
        bankAccountName: withdrawal.bankAccountName,
        requestedAt: withdrawal.requestedAt.toISOString(),
        processedAt: withdrawal.processedAt?.toISOString() ?? null,
        rejectionReason: withdrawal.rejectionReason,
      })),
    };
  }
}
