import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';

/** Applies migrations to the test database and empties every table. */
export default async function globalSetup() {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../.env.test'), quiet: true });
  config({ path: resolve(__dirname, '../.env'), quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (apps/api/.env.test)');
  for (const name of ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
    if (process.env[name] && process.env[name] === url) {
      throw new Error(`TEST_DATABASE_URL must not equal ${name} — e2e tests truncate every table.`);
    }
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
    stdio: 'pipe',
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length > 0) {
    await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  await client.end();
}
