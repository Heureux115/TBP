import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { CSRF_TOKEN_COOKIE } from '../../auth/auth.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SKIPPED_PATHS = new Set([
  '/api/v1/auth/csrf-token',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
]);

export function createCsrfToken() {
  return randomBytes(32).toString('hex');
}

export function csrfMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(request.method) || SKIPPED_PATHS.has(request.path)) {
    next();
    return;
  }

  const usesCookieAuth = Boolean(
    getCookie(request, 'tbp_access_token') ||
    getCookie(request, 'tbp_refresh_token'),
  );

  if (!usesCookieAuth) {
    next();
    return;
  }

  const cookieToken = getCookie(request, CSRF_TOKEN_COOKIE);
  const headerToken = request.header('x-csrf-token');

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    response.status(403).json({
      statusCode: 403,
      message: 'invalid csrf token',
      error: 'Forbidden',
    });
    return;
  }

  next();
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
