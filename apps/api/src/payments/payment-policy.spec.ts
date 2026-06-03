import { Prisma } from '@prisma/client';
import {
  calculateBookingGrossAmount,
  calculatePaymentSplit,
} from './payment-policy';

describe('payment policy', () => {
  it('splits paid tuition into 15% platform fee and 85% tutor payout', () => {
    const split = calculatePaymentSplit(new Prisma.Decimal(200000));

    expect(split.platformFeeAmount.toString()).toBe('30000');
    expect(split.tutorPayoutAmount.toString()).toBe('170000');
  });

  it('calculates booking gross amount from hourly rate and duration', () => {
    const startsAt = new Date('2026-06-01T03:00:00.000Z');
    const endsAt = new Date('2026-06-01T04:30:00.000Z');

    const gross = calculateBookingGrossAmount(120000, startsAt, endsAt);

    expect(gross.toString()).toBe('180000');
  });
});
