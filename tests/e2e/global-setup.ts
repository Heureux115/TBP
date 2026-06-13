import { execSync } from 'child_process';

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SEED === '1') {
    return;
  }

  execSync('npm.cmd run seed:e2e', {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}
