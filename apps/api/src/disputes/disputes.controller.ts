import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { ATTACHMENT_MAX_FILES } from '../common/file-storage';
import type { MultipartFile } from '../common/file-storage';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputesService } from './disputes.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post('disputes')
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(request.user, dto);
  }

  @Get('disputes/me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.disputesService.listMine(request.user);
  }

  @Get('disputes/:id')
  getMine(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.disputesService.getMine(request.user, id);
  }

  @Post('disputes/:id/messages')
  @UseInterceptors(FilesInterceptor('files', ATTACHMENT_MAX_FILES))
  addMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AddDisputeMessageDto,
    @UploadedFiles() files: MultipartFile[] = [],
  ) {
    return this.disputesService.addMessage(request.user, id, dto, files);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/disputes')
  listAdmin() {
    return this.disputesService.listAdmin();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/disputes/:id/review')
  markUnderReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.markUnderReview(
      request.user,
      id,
      dto.adminNote,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/disputes/:id/refund')
  resolveRefunded(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolveRefunded(
      request.user,
      id,
      dto.adminNote,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/disputes/:id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.reject(request.user, id, dto.adminNote);
  }
}
