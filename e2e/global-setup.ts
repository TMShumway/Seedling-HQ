import { execSync } from 'node:child_process';

export default function globalSetup() {
  console.log('E2E: resetting and seeding database...');
  execSync('pnpm --filter @seedling/api run db:reset && pnpm --filter @seedling/api run db:push && pnpm --filter @seedling/api run db:seed', {
    cwd: '..',
    stdio: 'inherit',
  });
}
