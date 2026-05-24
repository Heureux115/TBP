import { IsISO8601, IsOptional } from 'class-validator';

export class TutorAvailabilityQueryDto {
  @IsOptional()
  @IsISO8601()
  weekStart?: string;
}
