import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function checkLocalStack(): Promise<boolean> {
  // 1. Health check — LocalStack must be running
  try {
    const res = await fetch('http://localhost:4566/_localstack/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      console.log('E2E: LocalStack not reachable (photo tests will be skipped)');
      return false;
    }
  } catch {
    console.log('E2E: LocalStack not reachable (photo tests will be skipped)');
    return false;
  }

  // 2. Verify CDK resources are deployed (bucket exists)
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.localstack'), 'utf-8');
    const bucket = envFile.match(/^S3_BUCKET=(.+)$/m)?.[1];
    if (!bucket) {
      console.log('E2E: .env.localstack missing S3_BUCKET — run: bash scripts/localstack-deploy.sh');
      return false;
    }
    const bucketRes = await fetch(`http://localhost:4566/${bucket}`, { signal: AbortSignal.timeout(3000) });
    if (!bucketRes.ok) {
      console.log(`E2E: S3 bucket "${bucket}" not found — run: bash scripts/localstack-deploy.sh`);
      return false;
    }
  } catch {
    console.log('E2E: Could not verify S3 bucket — run: bash scripts/localstack-deploy.sh');
    return false;
  }

  console.log('E2E: LocalStack is running with CDK resources (photo tests enabled)');
  return true;
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
