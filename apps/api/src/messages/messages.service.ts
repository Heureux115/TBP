import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/auth.types';
import {
  ATTACHMENT_MAX_FILES,
  MultipartFile,
  saveUploadFile,
} from '../common/file-storage';
import { PrismaService } from '../prisma/prisma.service';

const conversationInclude = {
  booking: {
    include: {
      student: true,
      tutorProfile: {
        include: {
          user: true,
        },
      },
    },
  },
  participants: {
    include: {
      user: true,
    },
  },
  messages: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    include: {
      sender: true,
      deletions: true,
      attachments: true,
    },
  },
} satisfies Prisma.ConversationInclude;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

type ConversationBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureConversation(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      include: {
        tutorProfile: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('booking not found');
    }

    if (
      booking.studentId !== user.id &&
      booking.tutorProfile.userId !== user.id
    ) {
      throw new ForbiddenException('conversation access denied');
    }

    const participantIds = [booking.studentId, booking.tutorProfile.userId];
    const existingConversations = await this.prisma.conversation.findMany({
      where: {
        AND: participantIds.map((participantId) => ({
          participants: {
            some: {
              userId: participantId,
            },
          },
        })),
      },
      include: conversationInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const existingConversation =
      this.preferConversationWithMessages(existingConversations)[0] ?? null;

    const conversation =
      existingConversation ??
      (await this.prisma.conversation.create({
        data: {
          bookingId,
          participants: {
            createMany: {
              data: participantIds.map((participantId) => ({
                userId: participantId,
              })),
              skipDuplicates: true,
            },
          },
        },
        include: conversationInclude,
      }));

    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId: conversation.id, userId: user.id },
      data: { hiddenAt: null },
    });

    return this.serializeConversationWithLatestBooking(conversation, user.id);
  }

  async listConversations(user: AuthenticatedUser) {
    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TUTOR) {
      throw new ForbiddenException('only students and tutors can use messages');
    }

    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            hiddenAt: null,
          },
        },
      },
      include: conversationInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const deduped = this.dedupeConversations(
      this.preferConversationWithMessages(conversations),
      user.id,
    );
    return Promise.all(
      deduped.map((conversation) =>
        this.serializeConversationWithLatestBooking(conversation, user.id),
      ),
    );
  }

  async listMessages(user: AuthenticatedUser, conversationId: string) {
    await this.assertParticipant(user.id, conversationId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        deletions: {
          none: {
            userId: user.id,
          },
        },
      },
      include: {
        sender: true,
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return messages.map((message) => this.serializeMessage(message, user.id));
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    body = '',
    files: MultipartFile[] = [],
  ) {
    await this.assertParticipant(user.id, conversationId);
    const content = body.trim();

    if (!content && !files.length) {
      throw new BadRequestException('message body or attachment is required');
    }

    if (files.length > ATTACHMENT_MAX_FILES) {
      throw new BadRequestException('too many attachments');
    }

    const attachments = await Promise.all(
      files.map((file) => saveUploadFile(file, 'messages')),
    );

    const message = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.message.create({
        data: {
          conversationId,
          senderId: user.id,
          body: content,
          attachments: attachments.length
            ? {
                create: attachments.map((attachment) => ({
                  uploadedById: user.id,
                  url: attachment.url,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  size: attachment.size,
                  kind: attachment.kind,
                })),
              }
            : undefined,
        },
        include: {
          sender: true,
          attachments: true,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await tx.conversationParticipant.updateMany({
        where: { conversationId },
        data: { hiddenAt: null },
      });

      return saved;
    });

    return this.serializeMessage(message, user.id);
  }

  async deleteMessageForMe(
    user: AuthenticatedUser,
    conversationId: string,
    messageId: string,
  ) {
    await this.assertParticipant(user.id, conversationId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException('message not found');
    }

    await this.prisma.messageDeletion.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: user.id,
        },
      },
      create: {
        messageId,
        userId: user.id,
      },
      update: {
        deletedAt: new Date(),
      },
    });

    return { deleted: true };
  }

  async recallMessage(
    user: AuthenticatedUser,
    conversationId: string,
    messageId: string,
  ) {
    await this.assertParticipant(user.id, conversationId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) {
      throw new NotFoundException('message not found');
    }

    if (message.senderId !== user.id) {
      throw new ForbiddenException('only the sender can recall this message');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return { recalled: true };
  }

  async hideConversation(user: AuthenticatedUser, conversationId: string) {
    await this.assertParticipant(user.id, conversationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.id,
          },
        },
        data: { hiddenAt: new Date() },
      });

      const messages = await tx.message.findMany({
        where: {
          conversationId,
          deletedAt: null,
          deletions: {
            none: {
              userId: user.id,
            },
          },
        },
        select: { id: true },
      });

      await Promise.all(
        messages.map((message) =>
          tx.messageDeletion.upsert({
            where: {
              messageId_userId: {
                messageId: message.id,
                userId: user.id,
              },
            },
            create: {
              messageId: message.id,
              userId: user.id,
            },
            update: {
              deletedAt: new Date(),
            },
          }),
        ),
      );
    });

    return { hidden: true };
  }

  async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('conversation access denied');
    }
  }

  async listParticipantIds(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    return participants.map((participant) => participant.userId);
  }

  private serializeConversation(
    conversation: ConversationWithRelations,
    userId: string,
    latestBooking?: ConversationBooking | null,
  ) {
    const other = conversation.participants.find(
      (participant) => participant.userId !== userId,
    );
    const lastMessage =
      conversation.messages.find(
        (message) =>
          !message.deletions.some((deletion) => deletion.userId === userId),
      ) ?? null;

    return {
      id: conversation.id,
      bookingId: latestBooking?.id ?? conversation.bookingId,
      otherParticipant: other
        ? {
            id: other.user.id,
            fullName: other.user.fullName,
            email: other.user.email,
          }
        : null,
      booking: latestBooking
        ? {
            id: latestBooking.id,
            startsAt: latestBooking.startsAt.toISOString(),
            endsAt: latestBooking.endsAt.toISOString(),
            status: latestBooking.status,
          }
        : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body:
              lastMessage.body ||
              this.attachmentSummary(lastMessage.attachments ?? []),
            createdAt: lastMessage.createdAt.toISOString(),
            senderName: lastMessage.sender.fullName,
            mine: lastMessage.senderId === userId,
            attachments: (lastMessage.attachments ?? []).map((attachment) =>
              this.serializeAttachment(attachment),
            ),
          }
        : null,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private async serializeConversationWithLatestBooking(
    conversation: ConversationWithRelations,
    userId: string,
  ) {
    const other = conversation.participants.find(
      (participant) => participant.userId !== userId,
    );
    const latestBooking = other
      ? await this.findNearestBookingBetweenUsers(userId, other.userId)
      : conversation.booking;

    return this.serializeConversation(conversation, userId, latestBooking);
  }

  private async findNearestBookingBetweenUsers(
    userId: string,
    otherUserId: string,
  ) {
    const sharedWhere: Prisma.BookingWhereInput = {
      deletedAt: null,
      OR: [
        {
          studentId: userId,
          tutorProfile: {
            userId: otherUserId,
          },
        },
        {
          studentId: otherUserId,
          tutorProfile: {
            userId,
          },
        },
      ],
    };

    const upcoming = await this.prisma.booking.findFirst({
      where: {
        ...sharedWhere,
        startsAt: {
          gte: new Date(),
        },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    });

    if (upcoming) {
      return upcoming;
    }

    return this.prisma.booking.findFirst({
      where: sharedWhere,
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    });
  }

  private dedupeConversations(
    conversations: ConversationWithRelations[],
    userId: string,
  ) {
    const seenParticipantIds = new Set<string>();
    const uniqueConversations: ConversationWithRelations[] = [];

    for (const conversation of conversations) {
      const other = conversation.participants.find(
        (participant) => participant.userId !== userId,
      );

      if (!other) {
        uniqueConversations.push(conversation);
        continue;
      }

      if (seenParticipantIds.has(other.userId)) {
        continue;
      }

      seenParticipantIds.add(other.userId);
      uniqueConversations.push(conversation);
    }

    return uniqueConversations;
  }

  private preferConversationWithMessages(
    conversations: ConversationWithRelations[],
  ) {
    return [...conversations].sort((left, right) => {
      const leftHasMessages = left.messages.length > 0 ? 1 : 0;
      const rightHasMessages = right.messages.length > 0 ? 1 : 0;

      if (leftHasMessages !== rightHasMessages) {
        return rightHasMessages - leftHasMessages;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
  }

  private serializeMessage(
    message: Prisma.MessageGetPayload<{
      include: { sender: true; attachments: true };
    }>,
    userId: string,
  ) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        fullName: message.sender.fullName,
      },
      mine: message.senderId === userId,
      attachments: (message.attachments ?? []).map((attachment) =>
        this.serializeAttachment(attachment),
      ),
    };
  }

  private serializeAttachment(
    attachment: Prisma.MessageAttachmentGetPayload<object>,
  ) {
    return {
      id: attachment.id,
      url: attachment.url,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  private attachmentSummary(
    attachments: Prisma.MessageAttachmentGetPayload<object>[],
  ) {
    if (!attachments.length) return '';
    const hasImage = attachments.some((attachment) => attachment.kind === 'IMAGE');
    const hasDocument = attachments.some(
      (attachment) => attachment.kind === 'DOCUMENT',
    );
    if (hasImage && hasDocument) return 'Đã gửi ảnh và tài liệu';
    if (hasImage) return attachments.length > 1 ? 'Đã gửi ảnh' : 'Đã gửi một ảnh';
    return attachments.length > 1 ? 'Đã gửi tài liệu' : 'Đã gửi một tài liệu';
  }
}
