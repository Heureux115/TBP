import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  IMAGE_MIME_TYPES,
  MultipartFile,
  assertFileSize,
  saveUploadFile,
} from '../common/file-storage';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_COST = 12;

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(user: AuthenticatedUser, dto: UpdateProfileDto) {
    const phone = dto.phone?.trim() || null;

    if (phone) {
      const existing = await this.prisma.user.findFirst({
        where: {
          phone,
          id: { not: user.id },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('phone already exists');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: dto.fullName.trim(),
        phone,
      },
    });

    return { user: this.toPublicUser(updated) };
  }

  async uploadAvatar(user: AuthenticatedUser, file: MultipartFile) {
    assertFileSize(file);
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('avatar must be an image');
    }

    const saved = await saveUploadFile(file, 'avatars');
    const updated = await this.prisma.$transaction(async (tx) => {
      const savedUser = await tx.user.update({
        where: { id: user.id },
        data: { avatarUrl: saved.url },
      });

      if (user.role === UserRole.TUTOR) {
        await tx.tutorProfile.updateMany({
          where: { userId: user.id },
          data: { avatarUrl: saved.url },
        });
      }

      return savedUser;
    });

    return {
      avatarUrl: saved.url,
      user: this.toPublicUser(updated),
    };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('new password must be different');
    }

    const currentUser = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
    });

    if (!currentUser?.passwordHash) {
      throw new UnauthorizedException('current password is invalid');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      currentUser.passwordHash,
    );

    if (!matches) {
      throw new UnauthorizedException('current password is invalid');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password updated.' };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}
