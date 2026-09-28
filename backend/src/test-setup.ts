import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
// Overrides DATABASE_URL onto a separate database — the Prisma integration
// tests truncate every table in `beforeEach`, which would otherwise wipe
// whatever's in the same database `npm run start:dev` points at. See
// .env.test.example.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true, override: true });
