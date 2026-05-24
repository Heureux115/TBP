import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function securityMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
) {
  const requestId = request.header('x-request-id') || randomUUID();
  request.requestId = requestId;

  response.setHeader('x-request-id', requestId);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  next();
}
