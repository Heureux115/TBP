import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard, setRateLimitStoreForTesting } from './rate-limit.guard';

function contextFor(ip: string, path = '/auth/login') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path,
        ip,
        socket: {},
        header: () => undefined,
        route: { path },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  afterEach(() => {
    setRateLimitStoreForTesting(null);
  });

  it('blocks requests after the per-minute limit is exceeded', async () => {
    const guard = new RateLimitGuard();
    const context = contextFor('127.0.0.240');

    for (let index = 0; index < 10; index += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }

    await expect(guard.canActivate(context)).rejects.toThrow(
      'too many requests',
    );
  });

  it('uses the configured store atomically for hit counts', async () => {
    const hit = jest.fn().mockResolvedValue({ count: 11, resetAt: Date.now() });
    setRateLimitStoreForTesting({ hit });
    const guard = new RateLimitGuard();
    const context = contextFor('127.0.0.241');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'too many requests',
    );
    expect(hit).toHaveBeenCalledWith(
      'POST:/auth/login:127.0.0.241',
      60_000,
      expect.any(Number),
    );
  });
});
