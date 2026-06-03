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

  const weakSecrets = [
    'change-me-access-secret',
    'change-me-refresh-secret',
    'local-dev-access-secret',
    'local-dev-refresh-secret',
  ];
  const weakSecret = [
    ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET],
  ].find(([, value]) => value && weakSecrets.includes(value));

  if (process.env.NODE_ENV === 'production' && weakSecret) {
    throw new Error(
      `${weakSecret[0]} must be changed before running in production`,
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const productionRequired = [
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'ADMIN_PASSWORD',
    ];
    const productionMissing = productionRequired.filter(
      (key) => !process.env[key]?.trim(),
    );

    if (productionMissing.length) {
      throw new Error(
        `Missing production environment variables: ${productionMissing.join(', ')}`,
      );
    }

    if ((process.env.ADMIN_PASSWORD?.length ?? 0) < 16) {
      throw new Error(
        'ADMIN_PASSWORD must be at least 16 characters in production',
      );
    }
  }
}
