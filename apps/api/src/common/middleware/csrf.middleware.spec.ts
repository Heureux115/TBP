/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { createCsrfToken, csrfMiddleware } from './csrf.middleware';
import { CSRF_TOKEN_COOKIE } from '../../auth/auth.constants';

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function createRequest({
  cookie,
  method = 'POST',
  path = '/api/v1/bookings',
  token,
}: {
  cookie?: string;
  method?: string;
  path?: string;
  token?: string;
}) {
  return {
    method,
    path,
    header: jest.fn((name: string) => {
      if (name.toLowerCase() === 'cookie') return cookie;
      if (name.toLowerCase() === 'x-csrf-token') return token;
      return undefined;
    }),
  };
}

describe('csrfMiddleware', () => {
  it('allows safe methods', () => {
    const request = createRequest({ method: 'GET' });
    const response = createResponse();
    const next = jest.fn();

    csrfMiddleware(request as any, response as any, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('allows bearer-only requests without cookie session', () => {
    const request = createRequest({});
    const response = createResponse();
    const next = jest.fn();

    csrfMiddleware(request as any, response as any, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects cookie-auth mutating requests without a matching csrf token', () => {
    const request = createRequest({
      cookie: 'tbp_access_token=abc; tbp_csrf_token=expected',
      token: 'wrong',
    });
    const response = createResponse();
    const next = jest.fn();

    csrfMiddleware(request as any, response as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('allows cookie-auth mutating requests with matching csrf token', () => {
    const token = createCsrfToken();
    const request = createRequest({
      cookie: `tbp_access_token=abc; ${CSRF_TOKEN_COOKIE}=${token}`,
      token,
    });
    const response = createResponse();
    const next = jest.fn();

    csrfMiddleware(request as any, response as any, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });
});
