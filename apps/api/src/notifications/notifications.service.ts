import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type NotificationPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tx: Prisma.TransactionClient | PrismaService,
    payload: NotificationPayload,
  ) {
    return tx.notification.create({ data: payload });
  }

  async createMany(
    tx: Prisma.TransactionClient | PrismaService,
    payloads: NotificationPayload[],
  ) {
    if (!payloads.length) return;
    await tx.notification.createMany({ data: payloads });
  }

  async listMine(user: AuthenticatedUser) {
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      items: items.map((item) => this.serialize(item)),
    };
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('notification not found');
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenException('notification access denied');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });

    return this.serialize(updated);
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return this.listMine(user);
  }

  private serialize(item: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    actionUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      actionUrl: item.actionUrl,
      readAt: item.readAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
