import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  availabilitySlotId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  studentNote?: string;
}
