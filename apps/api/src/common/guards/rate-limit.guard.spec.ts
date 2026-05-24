import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

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
  it('blocks requests after the per-minute limit is exceeded', () => {
    const guard = new RateLimitGuard();
    const context = contextFor('127.0.0.240');

    for (let index = 0; index < 10; index += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }

    expect(() => guard.canActivate(context)).toThrow('too many requests');
  });
});
