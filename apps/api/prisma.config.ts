import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations use the direct (non-pooled) connection when one is provided.
const migrationUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
