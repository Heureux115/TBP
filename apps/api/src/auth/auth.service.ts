import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  AuthenticatedUser,
  JwtRefreshPayload,
  JwtAccessPayload,
} from './types/auth.types';

const BCRYPT_COST = 12;
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const role = dto.role ?? UserRole.STUDENT;

    if (role !== UserRole.STUDENT && role !== UserRole.TUTOR) {
      throw new BadRequestException('role must be STUDENT or TUTOR');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(dto.phone ? [{ phone: dto.phone }] : [])],
      },
    });

    if (existingUser?.email === email) {
      if (
        existingUser.status === UserStatus.PENDING_EMAIL_VERIFICATION &&
        !existingUser.emailVerifiedAt
      ) {
        return this.regenerateVerificationCode(existingUser.id);
      }

      throw new ConflictException('email already exists');
    }

    if (existingUser?.phone && existingUser.phone === dto.phone) {
      throw new ConflictException('phone already exists');
    }

    const verification = this.createEmailOtp();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone,
        role,
        status: UserStatus.PENDING_EMAIL_VERIFICATION,
        emailVerificationTokenHash: this.hashToken(verification.otp),
        emailVerificationTokenExpiresAt: verification.expiresAt,
      },
    });

    await this.emailService.sendVerificationOtp({
      to: user.email,
      fullName: user.fullName,
      otp: verification.otp,
    });

    return {
      user: this.toPublicUser(user),
      message: 'Verification code sent to email.',
    };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('account is suspended');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('invalid email or password');
    }

    const tokens = await this.issueTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('invalid refresh token');
    }

    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        id: payload.jti,
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!storedToken || storedToken.user.deletedAt) {
      throw new UnauthorizedException('invalid refresh token');
    }

    if (storedToken.user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('account is suspended');
    }

    await this.prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return this.issueTokens(storedToken.user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = this.normalizeEmail(dto.email);
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiresAt: {
          gt: new Date(),
        },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('invalid or expired verification token');
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return {
      user: this.toPublicUser(updatedUser),
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      return { message: 'If the email exists, a verification link was sent.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'Email is already verified.' };
    }

    return this.regenerateVerificationCode(user.id);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      return { message: 'If the email exists, a reset code was sent.' };
    }

    const reset = this.createPasswordResetOtp();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: this.hashToken(reset.otp),
        passwordResetTokenExpiresAt: reset.expiresAt,
      },
    });

    await this.emailService.sendPasswordResetOtp({
      to: user.email,
      fullName: user.fullName,
      otp: reset.otp,
    });

    return { message: 'If the email exists, a reset code was sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: {
          gt: new Date(),
        },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return { message: 'Password has been reset.' };
  }

  private async regenerateVerificationCode(userId: string) {
    const verification = this.createEmailOtp();

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        emailVerificationTokenHash: this.hashToken(verification.otp),
        emailVerificationTokenExpiresAt: verification.expiresAt,
      },
    });

    await this.emailService.sendVerificationOtp({
      to: updatedUser.email,
      fullName: updatedUser.fullName,
      otp: verification.otp,
    });

    return {
      message: 'Verification code sent to email.',
    };
  }

  async me(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findFirst({
      where: {
        id: user.id,
        deletedAt: null,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedException('user no longer exists');
    }

    return {
      user: this.toPublicUser(currentUser),
    };
  }

  private async issueTokens(user: User) {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
    const refreshTokenId = randomUUID();
    const refreshPayload: JwtRefreshPayload = {
      ...payload,
      jti: refreshTokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtl,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtRefreshPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('invalid refresh token');
    }
  }

  private createEmailOtp() {
    return {
      otp: randomInt(100000, 1000000).toString(),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    };
  }

  private createPasswordResetOtp() {
    return {
      otp: randomInt(100000, 1000000).toString(),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private get accessSecret() {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'local-dev-access-secret'
    );
  }

  private get refreshSecret() {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'local-dev-refresh-secret'
    );
  }

  private get accessTtl() {
    return (this.configService.get<string>('JWT_ACCESS_TTL') ??
      '15m') as JwtSignOptions['expiresIn'];
  }

  private get refreshTtl() {
    return (this.configService.get<string>('JWT_REFRESH_TTL') ??
      '7d') as JwtSignOptions['expiresIn'];
  }
}
