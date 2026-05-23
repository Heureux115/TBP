import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SubjectLevel, TeachingMode } from '@prisma/client';

export class TutorSubjectInputDto {
  @IsUUID()
  subjectId!: string;

  @IsEnum(SubjectLevel)
  level!: SubjectLevel;
}

export class UpsertTutorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  introVideoUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @IsNumberString()
  hourlyRate?: string;

  @IsOptional()
  @IsEnum(TeachingMode)
  teachingMode?: TeachingMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationDistrict?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TutorSubjectInputDto)
  subjects?: TutorSubjectInputDto[];
}
