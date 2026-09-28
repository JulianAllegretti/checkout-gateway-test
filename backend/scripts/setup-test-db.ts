// One-time local setup: creates the database `.env.test`'s DATABASE_URL points
// at (if missing) and applies migrations to it. Run via `npm run db:test:setup`.
//
// Exists because the Prisma integration tests truncate every table between
// tests (see product/transaction.repository.prisma.spec.ts) — they must never
// point at the same database as `npm run start:dev`, see .env.test.example.
import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const ALREADY_EXISTS = '42P04';

async function main(): Promise<void> {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) {
    console.error('DATABASE_URL is not set — copy backend/.env.test.example to backend/.env.test first.');
    process.exit(1);
  }

  const dbName = testUrl.match(/\/([^/?]+)(\?|$)/)?.[1];
  if (!dbName) throw new Error(`Could not parse a database name out of ${testUrl}`);

  // Connects to Postgres' own maintenance database to run CREATE DATABASE —
  // you can't create a database while connected to it.
  const adminUrl = testUrl.replace(/\/[^/]*(\?.*)?$/, '/postgres');
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}".`);
  } catch (e) {
    if ((e as { code?: string }).code === ALREADY_EXISTS) {
      console.log(`Database "${dbName}" already exists, skipping creation.`);
    } else {
      throw e;
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: testUrl } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
