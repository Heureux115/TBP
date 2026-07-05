import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/sanitize';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @SanitizeText()
  body?: string;
}
