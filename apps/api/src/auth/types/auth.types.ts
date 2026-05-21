import { UserRole, UserStatus } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type JwtRefreshPayload = JwtAccessPayload & {
  jti: string;
};
