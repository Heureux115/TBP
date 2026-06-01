import { IsEnum, IsUUID } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  bookingId!: string;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider = PaymentProvider.MOCK;
}
