import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TutorsService } from './tutors.service';
import { CreateTutorDocumentDto } from './dto/create-tutor-document.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { UpsertTutorProfileDto } from './dto/upsert-tutor-profile.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
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

  @Post('documents')
  createDocument(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTutorDocumentDto,
  ) {
    return this.tutorsService.createDocument(request.user, dto);
  }
}
