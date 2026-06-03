import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(request.user, dto);
  }

  @Get('tutors/:id/reviews')
  listForTutor(@Param('id') id: string) {
    return this.reviewsService.listForTutor(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reviews/eligible')
  listEligible(
    @Req() request: AuthenticatedRequest,
    @Query('tutorId') tutorId: string,
  ) {
    return this.reviewsService.listEligibleBookings(request.user, tutorId);
  }
}
