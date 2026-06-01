import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.keyFor(request);
    const now = Date.now();
    const limit = 10;
    const windowMs = 60_000;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.cleanup(now);
      return true;
    }

    if (bucket.count >= limit) {
      throw new HttpException(
        'too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private keyFor(request: Request) {
    const forwarded = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip =
      forwarded || request.ip || request.socket.remoteAddress || 'unknown';
    return `${request.method}:${request.path}:${ip}`;
  }

  private cleanup(now: number) {
    if (buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }
}
