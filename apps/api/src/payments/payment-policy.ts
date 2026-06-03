import { Prisma } from '@prisma/client';

export const PLATFORM_FEE_RATE = new Prisma.Decimal('0.15');

export function calculatePaymentSplit(amount: Prisma.Decimal.Value) {
  const grossAmount = new Prisma.Decimal(amount);
  const platformFeeAmount = grossAmount
    .mul(PLATFORM_FEE_RATE)
    .toDecimalPlaces(2);

  return {
    platformFeeAmount,
    tutorPayoutAmount: grossAmount.sub(platformFeeAmount).toDecimalPlaces(2),
  };
}

export function calculateBookingGrossAmount(
  hourlyRate: Prisma.Decimal.Value,
  startsAt: Date,
  endsAt: Date,
) {
  const minutes = Math.max(
    0,
    Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
  );

  return new Prisma.Decimal(hourlyRate).mul(minutes).div(60).toDecimalPlaces(2);
}
