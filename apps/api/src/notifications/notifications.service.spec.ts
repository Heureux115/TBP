/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';

const user = {
  id: 'user-1',
  email: 'user@example.com',
  role: UserRole.STUDENT,
};

function createNotification(overrides: Partial<any> = {}) {
  return {
    id: 'notification-1',
    userId: user.id,
    type: NotificationType.BOOKING_CONFIRMED,
    title: 'Booking confirmed',
    body: 'Your tutor confirmed the booking.',
    actionUrl: '/bookings/booking-1',
    readAt: null,
    createdAt: new Date('2026-06-01T03:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  it('lists current user notifications with unread count', async () => {
    const item = createNotification();
    const prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([[item], 1]),
    };
    const service = new NotificationsService(prisma as any);

    const result = await service.listMine(user as any);

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    expect(result.unreadCount).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: item.id,
        readAt: null,
        createdAt: item.createdAt.toISOString(),
      }),
    );
  });

  it('marks an owned notification as read', async () => {
    const item = createNotification();
    const readAt = new Date('2026-06-01T03:10:00.000Z');
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue(item),
        update: jest.fn().mockResolvedValue({ ...item, readAt }),
      },
    };
    const service = new NotificationsService(prisma as any);

    const result = await service.markRead(user as any, item.id);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: { readAt: expect.any(Date) },
    });
    expect(result.readAt).toBe(readAt.toISOString());
  });

  it('blocks reading another user notification', async () => {
    const prisma = {
      notification: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createNotification({ userId: 'other-user' })),
      },
    };
    const service = new NotificationsService(prisma as any);

    await expect(
      service.markRead(user as any, 'notification-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
