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
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminOperationsService } from './admin-operations.service';
import { AdminRefundPaymentDto } from './dto/admin-refund-payment.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminOperationsController {
  constructor(
    private readonly adminOperationsService: AdminOperationsService,
  ) {}

  @Get('bookings')
  listBookings(@Req() request: AuthenticatedRequest) {
    return this.adminOperationsService.listBookings(request.user);
  }

  @Get('summary')
  getSummary(@Req() request: AuthenticatedRequest) {
    return this.adminOperationsService.getSummary(request.user);
  }

  @Get('users')
  listUsers(
    @Req() request: AuthenticatedRequest,
    @Query('role', new ParseEnumPipe(UserRole, { optional: true }))
    role?: UserRole,
  ) {
    return this.adminOperationsService.listUsers(request.user, role);
  }

  @Get('payments')
  listPayments(@Req() request: AuthenticatedRequest) {
    return this.adminOperationsService.listPayments(request.user);
  }

  @Get('audit-logs')
  listAuditLogs() {
    return this.adminOperationsService.listAuditLogs();
  }

  @Patch('payments/:id/refund')
  refundPayment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AdminRefundPaymentDto,
  ) {
    return this.adminOperationsService.refundPayment(
      request.user,
      id,
      dto.reason,
    );
  }

  @Get('withdrawals')
  listWithdrawals() {
    return this.adminOperationsService.listWithdrawals();
  }

  @Patch('withdrawals/:id/processing')
  markWithdrawalProcessing(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.adminOperationsService.markWithdrawalProcessing(
      request.user,
      id,
    );
  }

  @Patch('withdrawals/:id/paid')
  markWithdrawalPaid(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.adminOperationsService.markWithdrawalPaid(request.user, id);
  }

  @Patch('withdrawals/:id/reject')
  rejectWithdrawal(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.adminOperationsService.rejectWithdrawal(
      request.user,
      id,
      dto.reason,
    );
  }
}
