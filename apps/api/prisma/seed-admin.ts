import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  const connectionString = requireEnv('DATABASE_URL');
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const fullName = requireEnv('ADMIN_FULL_NAME');
  const phone = process.env.ADMIN_PHONE?.trim() || null;

  if (password.length < 12) {
    console.warn(
      'Warning: ADMIN_PASSWORD is shorter than 12 characters. Use this only for local/dev testing.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const now = new Date();

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        fullName,
        phone,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
      },
      update: {
        passwordHash,
        fullName,
        phone,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
        deletedAt: null,
      },
    });

    console.log(`Admin account is ready: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  console.error(`Failed to seed admin account: ${message}`);
  process.exit(1);
});
