import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
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

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(request.user, dto);
  }

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.bookingsService.listMine(request.user);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(request.user, id, dto.reason);
  }
}
