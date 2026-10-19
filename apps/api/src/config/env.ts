import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    WEB_APP_URL: z.string().url().default('http://localhost:3000'),
    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    REDIS_URL: z.string().optional(),
    INVENTORY_AGING_HOURS: z.coerce.number().positive().default(24),
    INVENTORY_STALE_HOURS: z.coerce.number().positive().default(72),
    IMPORT_MAX_FILE_MB: z.coerce.number().positive().max(20).default(2),
    IMPORT_MAX_ROWS: z.coerce.number().int().positive().default(5000),
    THROTTLE_DISABLED: booleanString.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.INVENTORY_AGING_HOURS >= env.INVENTORY_STALE_HOURS) {
      ctx.addIssue({
        code: 'custom',
        path: ['INVENTORY_AGING_HOURS'],
        message: 'INVENTORY_AGING_HOURS must be lower than INVENTORY_STALE_HOURS',
      });
    }
    if (env.NODE_ENV === 'production' && env.THROTTLE_DISABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['THROTTLE_DISABLED'],
        message: 'Rate limiting cannot be disabled in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule.validate — fails fast at boot with a readable message (never echoes values). */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
