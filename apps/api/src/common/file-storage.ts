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

type Signature = {
  mimeType: string;
  offset: number;
  bytes: number[];
};

// Magic-byte signatures used to confirm a file's real content matches its
// declared MIME type. This defends against renamed/spoofed uploads where the
// extension or Content-Type lies about the actual payload.
const FILE_SIGNATURES: Signature[] = [
  { mimeType: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: "RIFF"...."WEBP"
  { mimeType: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { mimeType: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // ZIP container (docx/xlsx/pptx): "PK\x03\x04"
  { mimeType: 'zip', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
];

const ZIP_BASED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function matchesSignature(buffer: Buffer, signature: Signature) {
  return signature.bytes.every(
    (byte, index) => buffer[signature.offset + index] === byte,
  );
}

/**
 * Verify that the file's binary content matches its declared MIME type.
 *
 * Types without a reliable magic number (legacy Office binary formats,
 * text/plain) are allowed through after the MIME + size checks. Modern Office
 * formats are validated as ZIP containers.
 */
export function assertContentMatchesMime(file: MultipartFile) {
  const expected = ZIP_BASED_MIME_TYPES.has(file.mimetype)
    ? 'zip'
    : file.mimetype;

  const signature = FILE_SIGNATURES.find((item) => item.mimeType === expected);

  // No signature on record for this type: rely on the earlier MIME + size
  // checks rather than rejecting valid but unsigned formats.
  if (!signature) {
    return;
  }

  if (!matchesSignature(file.buffer, signature)) {
    throw new BadRequestException('file content does not match its type');
  }
}

export function safeOriginalName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim() || 'file';
}

export async function saveUploadFile(
  file: MultipartFile,
  folder: 'avatars' | 'messages',
) {
  assertFileSize(file);
  const kind = classifyAttachment(file);
  assertContentMatchesMime(file);
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
