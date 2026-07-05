import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit_options';

export type RateLimitOptions = {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Length of the rate-limit window in milliseconds. */
  windowMs: number;
};

/**
 * Override the default rate-limit settings for a specific route.
 *
 * Example:
 *   @RateLimit({ limit: 5, windowMs: 60_000 })
 *   @Post()
 *   create() {}
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
