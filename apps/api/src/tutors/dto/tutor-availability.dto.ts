import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum AvailabilityRepeat {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class MyTutorAvailabilityQueryDto {
  @IsOptional()
  @IsISO8601()
  weekStart?: string;
}

export class CreateAvailabilitySlotDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsEnum(AvailabilityRepeat)
  repeat?: AvailabilityRepeat;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  occurrences?: number;
}

export class DeleteAvailabilitySlotDto {
  @IsUUID()
  id!: string;
}
