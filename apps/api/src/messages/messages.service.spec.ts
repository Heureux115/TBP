/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { UserRole } from '@prisma/client';
import { MessagesService } from './messages.service';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};
const tutorUser = {
  id: 'tutor-user-1',
  fullName: 'Tutor',
  email: 'tutor@example.com',
};

function createConversation(overrides: Partial<any> = {}) {
  return {
    id: 'conversation-1',
    bookingId: 'booking-1',
    updatedAt: new Date('2026-06-01T03:00:00.000Z'),
    booking: null,
    participants: [
      {
        userId: student.id,
        user: { id: student.id, fullName: 'Student', email: student.email },
      },
      {
        userId: tutorUser.id,
        user: tutorUser,
      },
    ],
    messages: [],
    ...overrides,
  };
}

describe('MessagesService', () => {
  it('reuses one conversation for the same student and tutor even when booking changes', async () => {
    const booking = {
      id: 'booking-2',
      studentId: student.id,
      tutorProfile: { userId: tutorUser.id },
      deletedAt: null,
    };
    const existing = createConversation({
      id: 'conversation-existing',
      bookingId: 'booking-1',
    });
    const latestBooking = {
      id: booking.id,
      startsAt: new Date('2026-06-02T03:00:00.000Z'),
      endsAt: new Date('2026-06-02T04:00:00.000Z'),
      status: 'CONFIRMED',
    };
    const prisma = {
      booking: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(booking)
          .mockResolvedValueOnce(latestBooking),
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([existing]),
        create: jest.fn(),
      },
      conversationParticipant: { updateMany: jest.fn() },
    };
    const service = new MessagesService(prisma as any);

    const result = await service.ensureConversation(student as any, booking.id);

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(result.id).toBe(existing.id);
    expect(result.bookingId).toBe(booking.id);
  });

  it('dedupes conversation list by the other participant and keeps the conversation with messages', async () => {
    const emptyConversation = createConversation({
      id: 'empty-conversation',
      updatedAt: new Date('2026-06-02T03:00:00.000Z'),
      messages: [],
    });
    const conversationWithMessage = createConversation({
      id: 'conversation-with-message',
      updatedAt: new Date('2026-06-01T03:00:00.000Z'),
      messages: [
        {
          id: 'message-1',
          body: 'Hello',
          createdAt: new Date('2026-06-01T03:00:00.000Z'),
          senderId: tutorUser.id,
          sender: tutorUser,
          deletions: [],
        },
      ],
    });
    const prisma = {
      conversation: {
        findMany: jest
          .fn()
          .mockResolvedValue([emptyConversation, conversationWithMessage]),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-latest',
          startsAt: new Date('2026-06-03T03:00:00.000Z'),
          endsAt: new Date('2026-06-03T04:00:00.000Z'),
          status: 'PENDING',
        }),
      },
    };
    const service = new MessagesService(prisma as any);

    const result = await service.listConversations(student as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(conversationWithMessage.id);
    expect(result[0].lastMessage?.body).toBe('Hello');
  });

  it('hides the conversation and deletes all existing messages for the requester only', async () => {
    const tx = {
      conversationParticipant: {
        update: jest.fn().mockResolvedValue({}),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([{ id: 'message-1' }, { id: 'message-2' }]),
      },
      messageDeletion: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      conversationParticipant: {
        findUnique: jest.fn().mockResolvedValue({ conversationId: 'conversation-1', userId: student.id }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new MessagesService(prisma as any);

    const result = await service.hideConversation(student as any, 'conversation-1');

    expect(result).toEqual({ hidden: true });
    expect(tx.conversationParticipant.update).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'conversation-1',
          userId: student.id,
        },
      },
      data: { hiddenAt: expect.any(Date) },
    });
    expect(tx.message.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        deletedAt: null,
        deletions: {
          none: {
            userId: student.id,
          },
        },
      },
      select: { id: true },
    });
    expect(tx.messageDeletion.upsert).toHaveBeenCalledTimes(2);
    expect(tx.messageDeletion.upsert).toHaveBeenCalledWith({
      where: {
        messageId_userId: {
          messageId: 'message-1',
          userId: student.id,
        },
      },
      create: {
        messageId: 'message-1',
        userId: student.id,
      },
      update: {
        deletedAt: expect.any(Date),
      },
    });
  });
});
