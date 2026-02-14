import { execSync } from 'node:child_process';

async function checkLocalStack(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:4566/_localstack/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log('E2E: LocalStack is running (photo tests enabled)');
      return true;
    }
  } catch {
    // ignore
  }
  console.log('E2E: LocalStack not reachable (photo tests will be skipped)');
  return false;
}

export default async function globalSetup() {
  console.log('E2E: resetting and seeding database...');
  execSync('pnpm --filter @seedling/api run db:reset && pnpm --filter @seedling/api run db:push && pnpm --filter @seedling/api run db:seed-test', {
    cwd: '..',
    stdio: 'inherit',
  });

  const localStackReady = await checkLocalStack();
  process.env.LOCALSTACK_AVAILABLE = localStackReady ? 'true' : 'false';
}
