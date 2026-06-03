/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { EventEmitter } from 'events';
import { securityMiddleware } from './security.middleware';

function createResponse() {
  const response = new EventEmitter() as EventEmitter & {
    headers: Record<string, string>;
    statusCode: number;
    setHeader: jest.Mock;
  };
  response.headers = {};
  response.statusCode = 200;
  response.setHeader = jest.fn((key: string, value: string) => {
    response.headers[key.toLowerCase()] = value;
  });
  return response;
}

describe('securityMiddleware', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('adds baseline security headers', () => {
    const request = {
      header: jest.fn().mockReturnValue(undefined),
      method: 'GET',
      originalUrl: '/api/v1/health',
    };
    const response = createResponse();
    const next = jest.fn();

    securityMiddleware(request as any, response as any, next);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(next).toHaveBeenCalled();
  });

  it('adds HSTS in production', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    const request = {
      header: jest.fn().mockReturnValue(undefined),
      method: 'GET',
      originalUrl: '/api/v1/health',
    };
    const response = createResponse();

    securityMiddleware(request as any, response as any, jest.fn());

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});
