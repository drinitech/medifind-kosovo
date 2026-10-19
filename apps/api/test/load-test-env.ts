import { config } from 'dotenv';
import { resolve } from 'node:path';

/** Points the app at the disposable test database before any module is loaded. */
export function loadTestEnv() {
  config({ path: resolve(__dirname, '../.env.test'), quiet: true });
  config({ path: resolve(__dirname, '../.env'), quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Create apps/api/.env.test (see .env.example) pointing at a disposable database.');
  }
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.THROTTLE_DISABLED = 'true';
  process.env.REDIS_URL = '';
  process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-validation-123';
  return testUrl;
}

loadTestEnv();
