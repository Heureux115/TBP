import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TeachingMode } from '@prisma/client';

export class CreateBookingDto {
  @IsUUID()
  availabilitySlotId!: string;

  @IsOptional()
  @IsEnum(TeachingMode)
  teachingMode?: TeachingMode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  studentNote?: string;
}
