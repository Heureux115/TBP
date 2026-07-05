import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createClient } from 'redis';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type Bucket = {
  count: number;
  resetAt: number;
};

type RedisCommandClient = {
  connect(): Promise<unknown>;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  sendCommand(command: string[]): Promise<unknown>;
};

export type RateLimitHit = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  hit(key: string, windowMs: number, now: number): Promise<RateLimitHit>;
};

const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 10,
  windowMs: 60_000,
};

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async hit(key: string, windowMs: number, now: number) {
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const nextBucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, nextBucket);
      this.cleanup(now);
      return nextBucket;
    }

    bucket.count += 1;
    return bucket;
  }

  private cleanup(now: number) {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private clientPromise?: Promise<RedisCommandClient>;

  constructor(private readonly url: string) {}

  async hit(key: string, windowMs: number, now: number) {
    const client = await this.getClient();
    const result = await client.sendCommand([
      'EVAL',
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return count;",
      '1',
      key,
      String(windowMs),
    ]);

    return {
      count: Number(result),
      resetAt: now + windowMs,
    };
  }

  private getClient() {
    this.clientPromise ??= (async () => {
      const client = createClient({ url: this.url }) as RedisCommandClient;
      client.on('error', (error) => {
        Logger.warn(
          `Redis rate-limit client error: ${error instanceof Error ? error.message : String(error)}`,
          RateLimitGuard.name,
        );
      });
      await client.connect();
      return client;
    })();

    return this.clientPromise;
  }
}

const inMemoryStore = new InMemoryRateLimitStore();
let redisStore: RedisRateLimitStore | null = null;
let testStore: RateLimitStore | null = null;

export function setRateLimitStoreForTesting(store: RateLimitStore | null) {
  testStore = store;
}

function getRateLimitStore() {
  if (testStore) {
    return testStore;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return inMemoryStore;
  }

  redisStore ??= new RedisRateLimitStore(redisUrl);
  return redisStore;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Optional() private readonly reflector?: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const { limit, windowMs } = this.resolveOptions(context);
    const key = this.keyFor(request);
    const now = Date.now();
    const bucket = await getRateLimitStore().hit(key, windowMs, now);

    if (bucket.count > limit) {
      throw new HttpException(
        'too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveOptions(context: ExecutionContext): RateLimitOptions {
    const options = this.reflector?.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    return options ?? DEFAULT_OPTIONS;
  }

  private keyFor(request: Request) {
    const forwarded = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip =
      forwarded || request.ip || request.socket.remoteAddress || 'unknown';
    return `${request.method}:${request.path}:${ip}`;
  }

}
