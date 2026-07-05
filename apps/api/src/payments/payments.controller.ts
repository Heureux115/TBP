import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 15, windowMs: 60_000 })
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(request.user, dto);
  }

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.paymentsService.listMine(request.user);
  }

  @Get(':id')
  getOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.getOne(request.user, id);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 15, windowMs: 60_000 })
  @Patch(':id/mock-confirm')
  mockConfirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.mockConfirm(request.user, id);
  }
}
