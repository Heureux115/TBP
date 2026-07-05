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
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 15, windowMs: 60_000 })
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(request.user, dto);
  }

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.bookingsService.listMine(request.user);
  }

  @Get(':id')
  getOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.getOne(request.user, id);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 15, windowMs: 60_000 })
  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(request.user, id, dto.reason);
  }

  @Patch(':id/confirm')
  confirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.confirm(request.user, id);
  }

  @Patch(':id/complete')
  complete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.complete(request.user, id);
  }
}
