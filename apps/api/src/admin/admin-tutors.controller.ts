import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TutorVerificationStatus, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { TutorsService } from '../tutors/tutors.service';
import { RejectTutorDto } from './dto/reject-tutor.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/tutors')
export class AdminTutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get()
  listTutors(
    @Query(
      'status',
      new ParseEnumPipe(TutorVerificationStatus, { optional: true }),
    )
    status?: TutorVerificationStatus,
  ) {
    return this.tutorsService.listAdminTutors(status);
  }

  @Get(':id')
  getTutor(@Param('id') id: string) {
    return this.tutorsService.getAdminTutor(id);
  }

  @Patch(':id/approve')
  approveTutor(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.tutorsService.approveTutor(request.user, id);
  }

  @Patch(':id/reject')
  rejectTutor(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectTutorDto,
  ) {
    return this.tutorsService.rejectTutor(request.user, id, dto.reason);
  }
}
