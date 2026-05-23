import { IsEnum, IsString, MaxLength } from 'class-validator';
import { TutorDocumentType } from '@prisma/client';

export class UploadUrlDto {
  @IsEnum(TutorDocumentType)
  type!: TutorDocumentType;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;
}
