/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const createdAt = new Date('2026-06-27T00:00:00.000Z');

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    email: 'student@example.com',
    passwordHash: 'hashed-password',
    fullName: 'Student Tester',
    phone: null,
    avatarUrl: null,
    role: UserRole.STUDENT,
    status: UserStatus.PENDING_EMAIL_VERIFICATION,
    emailVerifiedAt: null,
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createService() {
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const emailService = {
    sendPasswordResetOtp: jest.fn(),
    sendVerificationOtp: jest.fn(),
  };

  return {
    configService,
    emailService,
    jwtService,
    prisma,
    service: new AuthService(
      prisma as any,
      jwtService as any,
      configService as any,
      emailService as any,
    ),
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  it('returns a verification code when registering a new user', async () => {
    const { emailService, prisma, service } = createService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      createUser({
        email: data.email,
        fullName: data.fullName,
        phone: data.phone ?? null,
        role: data.role,
        status: data.status,
        emailVerificationTokenHash: data.emailVerificationTokenHash,
        emailVerificationTokenExpiresAt: data.emailVerificationTokenExpiresAt,
      }),
    );

    const result = await service.register({
      email: ' Student@Example.com ',
      password: 'Password@123',
      fullName: ' Student Tester ',
      role: UserRole.STUDENT,
    });

    expect(result.verificationCode).toMatch(/^\d{6}$/);
    expect(result.user.email).toBe('student@example.com');
    expect(result.user.fullName).toBe('Student Tester');
    expect(emailService.sendVerificationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        otp: result.verificationCode,
        to: 'student@example.com',
      }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerificationTokenHash: hashToken(result.verificationCode),
        }),
      }),
    );
  });

  it('returns a new verification code for an existing pending user', async () => {
    const { emailService, prisma, service } = createService();
    const pendingUser = createUser({ id: 'pending-user' });
    prisma.user.findFirst.mockResolvedValue(pendingUser);
    prisma.user.update.mockImplementation(({ data }) =>
      createUser({
        ...pendingUser,
        emailVerificationTokenHash: data.emailVerificationTokenHash,
        emailVerificationTokenExpiresAt: data.emailVerificationTokenExpiresAt,
      }),
    );

    const result = await service.register({
      email: 'student@example.com',
      password: 'Password@123',
      fullName: 'Student Tester',
      role: UserRole.STUDENT,
    });

    expect(result.verificationCode).toMatch(/^\d{6}$/);
    expect(result.user.id).toBe('pending-user');
    expect(emailService.sendVerificationOtp).toHaveBeenCalledWith(
      expect.objectContaining({ otp: result.verificationCode }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pending-user' },
        data: expect.objectContaining({
          emailVerificationTokenHash: hashToken(result.verificationCode),
        }),
      }),
    );
  });

  it('keeps active duplicate emails as conflicts without returning a code', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(
      createUser({
        status: UserStatus.ACTIVE,
        emailVerifiedAt: createdAt,
      }),
    );

    await expect(
      service.register({
        email: 'student@example.com',
        password: 'Password@123',
        fullName: 'Student Tester',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('verifies an email using the returned verification code', async () => {
    const { prisma, service } = createService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      createUser({
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        status: data.status,
        emailVerificationTokenHash: data.emailVerificationTokenHash,
        emailVerificationTokenExpiresAt: data.emailVerificationTokenExpiresAt,
      }),
    );

    const registration = await service.register({
      email: 'student@example.com',
      password: 'Password@123',
      fullName: 'Student Tester',
      role: UserRole.STUDENT,
    });
    const verifiedUser = createUser({
      status: UserStatus.ACTIVE,
      emailVerifiedAt: createdAt,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    });
    prisma.user.findFirst.mockResolvedValueOnce(createUser());
    prisma.user.update.mockResolvedValue(verifiedUser);

    const result = await service.verifyEmail({
      email: 'student@example.com',
      token: registration.verificationCode,
    });

    expect(result.user.status).toBe(UserStatus.ACTIVE);
    expect(prisma.user.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          emailVerificationTokenHash: hashToken(registration.verificationCode),
        }),
      }),
    );
  });

  it('returns a reset code for an existing email and stores its hash', async () => {
    const { emailService, prisma, service } = createService();
    const user = createUser({ status: UserStatus.ACTIVE, emailVerifiedAt: createdAt });
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    const result = await service.forgotPassword({ email: 'student@example.com' });

    expect(result.resetCode).toMatch(/^\d{6}$/);
    expect(emailService.sendPasswordResetOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        otp: result.resetCode,
        to: 'student@example.com',
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({
          passwordResetTokenHash: hashToken(result.resetCode as string),
        }),
      }),
    );
  });

  it('does not return a reset code for an unknown email', async () => {
    const { emailService, prisma, service } = createService();
    prisma.user.findFirst.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@example.com' });

    expect(result).toEqual({ message: 'If the email exists, a reset code was sent.' });
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });
});
