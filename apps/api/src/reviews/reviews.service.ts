import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

const reviewInclude = {
  student: true,
  booking: true,
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateReviewDto) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can review tutors');
    }

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: dto.bookingId,
        studentId: user.id,
        deletedAt: null,
      },
      include: {
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('booking must be completed before review');
    }

    if (!booking.payment || booking.payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('booking must be paid before review');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookingId: booking.id,
          studentId: user.id,
          tutorProfileId: booking.tutorProfileId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
        include: reviewInclude,
      });

      await this.recalculateTutorRating(tx, booking.tutorProfileId);

      return review;
    });

    return this.serializeReview(created);
  }

  async listForTutor(tutorProfileId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        tutorProfileId,
        deletedAt: null,
      },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return reviews.map((review) => this.serializeReview(review));
  }

  async listEligibleBookings(user: AuthenticatedUser, tutorProfileId: string) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('only students can review tutors');
    }

    if (!tutorProfileId) {
      throw new BadRequestException('tutorId is required');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        studentId: user.id,
        tutorProfileId,
        status: BookingStatus.COMPLETED,
        deletedAt: null,
        payment: {
          status: PaymentStatus.PAID,
        },
        review: null,
      },
      orderBy: { startsAt: 'desc' },
    });

    return bookings.map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
    }));
  }

  private async recalculateTutorRating(
    tx: Prisma.TransactionClient,
    tutorProfileId: string,
  ) {
    const aggregate = await tx.review.aggregate({
      where: {
        tutorProfileId,
        deletedAt: null,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.tutorProfile.update({
      where: { id: tutorProfileId },
      data: {
        ratingAvg: new Prisma.Decimal(aggregate._avg.rating ?? 0),
        totalSessions: aggregate._count.rating,
      },
    });
  }

  private serializeReview(review: ReviewWithRelations) {
    return {
      id: review.id,
      bookingId: review.bookingId,
      tutorProfileId: review.tutorProfileId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      student: {
        id: review.student.id,
        fullName: review.student.fullName,
      },
      booking: {
        id: review.booking.id,
        startsAt: review.booking.startsAt.toISOString(),
        endsAt: review.booking.endsAt.toISOString(),
      },
    };
  }
}
