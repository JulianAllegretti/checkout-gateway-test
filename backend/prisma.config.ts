import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Plain lookup (not the `env()` helper) on purpose: `env()` throws if the var is
  // unset, but `prisma generate` (e.g. during a Docker build, before DATABASE_URL
  // exists) doesn't need a real connection — only `migrate`/`db seed` do, and those
  // always run with a real .env present.
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node --require ts-node/register prisma/seed.ts',
  },
});
