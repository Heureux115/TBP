import { validateEnv } from './validate-env';

const originalEnv = process.env;

describe('validateEnv', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      JWT_ACCESS_SECRET: 'a-secure-access-secret',
      JWT_REFRESH_SECRET: 'a-secure-refresh-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects missing required variables', () => {
    delete process.env.JWT_ACCESS_SECRET;

    expect(() => validateEnv()).toThrow(
      'Missing required environment variables',
    );
  });

  it('rejects weak JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'change-me-access-secret';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'TutorConnect <no-reply@example.com>';
    process.env.ADMIN_PASSWORD = 'very-long-admin-password';

    expect(() => validateEnv()).toThrow('JWT_ACCESS_SECRET must be changed');
  });

  it('requires production-only email and admin settings', () => {
    process.env.NODE_ENV = 'production';

    expect(() => validateEnv()).toThrow(
      'Missing production environment variables',
    );
  });
});
