const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const weakSecrets = ['change-me-access-secret', 'change-me-refresh-secret'];
  const weakSecret = [
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_REFRESH_SECRET,
  ].find((value) => value && weakSecrets.includes(value));

  if (process.env.NODE_ENV === 'production' && weakSecret) {
    throw new Error('JWT secrets must be changed before running in production');
  }
}
