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
  response.setHeader('cross-origin-resource-policy', 'same-site');
  response.setHeader(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=()',
  );

  if (process.env.NODE_ENV === 'production') {
    response.setHeader(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );
  }

  const startedAt = Date.now();
  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const method = request.method;
    const url = request.originalUrl;
    const statusCode = response.statusCode;
    console.log(`${requestId} ${method} ${url} ${statusCode} ${durationMs}ms`);
  });

  next();
}
