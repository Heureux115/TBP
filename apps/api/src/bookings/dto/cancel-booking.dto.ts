import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/sanitize';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  reason?: string;
}
