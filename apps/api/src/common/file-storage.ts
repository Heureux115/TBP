import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AttachmentKind } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

export type MultipartFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_FILES = 5;

export function classifyAttachment(file: MultipartFile) {
  if (IMAGE_MIME_TYPES.has(file.mimetype)) return AttachmentKind.IMAGE;
  if (DOCUMENT_MIME_TYPES.has(file.mimetype)) return AttachmentKind.DOCUMENT;
  throw new BadRequestException('unsupported file type');
}

export function assertFileSize(file: MultipartFile, maxSize = ATTACHMENT_MAX_SIZE_BYTES) {
  if (!file) {
    throw new BadRequestException('file is required');
  }

  if (file.size > maxSize) {
    throw new BadRequestException('file is too large');
  }
}

export function safeOriginalName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim() || 'file';
}

export async function saveUploadFile(
  file: MultipartFile,
  folder: 'avatars' | 'disputes' | 'messages',
) {
  assertFileSize(file);
  const kind = classifyAttachment(file);
  const uploadRoot = resolve(process.cwd(), 'uploads');
  const targetDir = join(uploadRoot, folder);
  const extension = extname(file.originalname).toLowerCase();
  const storedName = `${randomUUID()}${extension}`;
  const targetPath = join(targetDir, storedName);

  await mkdir(targetDir, { recursive: true });

  try {
    await writeFile(targetPath, file.buffer);
  } catch {
    throw new InternalServerErrorException('could not save uploaded file');
  }

  return {
    fileName: safeOriginalName(file.originalname),
    kind,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${folder}/${storedName}`,
  };
}
