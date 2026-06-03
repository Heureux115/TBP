/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};
const tutor = {
  id: 'tutor-user-1',
  email: 'tutor@example.com',
  role: UserRole.TUTOR,
};

function createBooking(overrides: Partial<any> = {}) {
  return {
    id: 'booking-1',
    studentId: student.id,
    tutorProfileId: 'tutor-profile-1',
    status: BookingStatus.COMPLETED,
    startsAt: new Date('2026-06-01T03:00:00.000Z'),
    endsAt: new Date('2026-06-01T04:00:00.000Z'),
    payment: { id: 'payment-1', status: PaymentStatus.PAID },
    ...overrides,
  };
}

function createReview(overrides: Partial<any> = {}) {
  const booking = createBooking();
  return {
    id: 'review-1',
    bookingId: booking.id,
    studentId: student.id,
    tutorProfileId: booking.tutorProfileId,
    rating: 5,
    comment: 'Great lesson',
    createdAt: new Date('2026-06-01T05:00:00.000Z'),
    student: { id: student.id, fullName: 'Student' },
    booking,
    ...overrides,
  };
}

describe('ReviewsService', () => {
  it('lets a student review only a completed paid booking and recalculates tutor rating', async () => {
    const booking = createBooking();
    const review = createReview({ booking });
    const tx = {
      review: {
        create: jest.fn().mockResolvedValue(review),
        aggregate: jest.fn(),
      },
      tutorProfile: { update: jest.fn() },
    };
    tx.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new ReviewsService(prisma as any);

    const result = await service.create(student as any, {
      bookingId: booking.id,
      rating: 5,
      comment: ' Great lesson ',
    });

    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: booking.id,
          studentId: student.id,
          tutorProfileId: booking.tutorProfileId,
          comment: 'Great lesson',
        }),
      }),
    );
    expect(tx.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: booking.tutorProfileId },
      data: { ratingAvg: new Prisma.Decimal(4.5), totalSessions: 2 },
    });
    expect(result.rating).toBe(5);
  });

  it('blocks tutors from reviewing themselves', async () => {
    const service = new ReviewsService({} as any);

    await expect(
      service.create(tutor as any, {
        bookingId: 'booking-1',
        rating: 5,
        comment: 'Good',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks reviews before booking is completed', async () => {
    const service = new ReviewsService({
      booking: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            createBooking({ status: BookingStatus.CONFIRMED }),
          ),
      },
    } as any);

    await expect(
      service.create(student as any, {
        bookingId: 'booking-1',
        rating: 5,
        comment: 'Good',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
