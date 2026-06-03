import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ParseEnumPipe } from '@nestjs/common';
import { TutorDocumentType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TutorsService } from './tutors.service';
import { UploadUrlDto } from './dto/upload-url.dto';
import { UpsertTutorProfileDto } from './dto/upsert-tutor-profile.dto';
import {
  CreateAvailabilitySlotDto,
  DeleteAvailabilitySlotDto,
  MyTutorAvailabilityQueryDto,
} from './dto/tutor-availability.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

type MultipartFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@UseGuards(JwtAuthGuard)
@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('me')
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.tutorsService.getMyProfile(request.user);
  }

  @Post('me')
  createMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpsertTutorProfileDto,
  ) {
    return this.tutorsService.upsertMyProfile(request.user, dto);
  }

  @Patch('me')
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpsertTutorProfileDto,
  ) {
    return this.tutorsService.upsertMyProfile(request.user, dto);
  }

  @Post('me/submit-verification')
  submitVerification(@Req() request: AuthenticatedRequest) {
    return this.tutorsService.submitMyVerification(request.user);
  }

  @Get('me/availability')
  getMyAvailability(
    @Req() request: AuthenticatedRequest,
    @Query() query: MyTutorAvailabilityQueryDto,
  ) {
    return this.tutorsService.getMyAvailability(request.user, query.weekStart);
  }

  @Post('me/availability')
  createAvailabilitySlot(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return this.tutorsService.createAvailabilitySlot(request.user, dto);
  }

  @Delete('me/availability')
  deleteAvailabilitySlot(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DeleteAvailabilitySlotDto,
  ) {
    return this.tutorsService.deleteAvailabilitySlot(request.user, dto.id);
  }

  @Get('me/documents')
  getMyDocuments(@Req() request: AuthenticatedRequest) {
    return this.tutorsService.getMyDocuments(request.user);
  }

  @Post('documents/upload-url')
  createUploadUrl(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadUrlDto,
  ) {
    return this.tutorsService.createUploadUrl(request.user, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: MultipartFile,
  ) {
    return this.tutorsService.uploadAvatar(request.user, file);
  }

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() request: AuthenticatedRequest,
    @Body('type', new ParseEnumPipe(TutorDocumentType)) type: TutorDocumentType,
    @UploadedFile() file: MultipartFile,
  ) {
    return this.tutorsService.uploadDocument(request.user, type, file);
  }
}
