import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { TutorDocumentType } from '@prisma/client';

export class CreateTutorDocumentDto {
  @IsEnum(TutorDocumentType)
  type!: TutorDocumentType;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(1000)
  filePath!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  fileSizeBytes!: number;
}
