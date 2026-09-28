# Checkout Gateway Test

A checkout flow where a customer pays for a product by credit card through an
external payment gateway (sandbox integration). Fullstack take-home test.

## Stack

- **Frontend**: React (SPA) + Redux
- **Backend**: NestJS, arquitectura hexagonal (Ports & Adapters) + Railway Oriented
  Programming (`neverthrow`)
- **DB**: PostgreSQL
- **Infra**: Terraform, AWS (EC2 + Docker Compose, S3 + CloudFront)
- **Observabilidad**: Sentry + logs estructurados (pino)

## Documentation

- [PRD](specs/PRD.md) — functional and business requirements
- [ADR 0001 — Architecture overview](specs/decisions/0001-architecture-overview.md)
- [API contract](specs/API-CONTRACT.md)
- [Data model](specs/DATA-MODEL.md)
- [ARD — Architecture reference](specs/ARD.md)
- Per-app specs/TDD/tasks: [backend](backend/specs/), [frontend](frontend/specs/), [infra](infra/specs/)

## Local development

1. **Database**: `docker compose up -d postgres` (or point `DATABASE_URL` at any
   local Postgres instance).
2. **Backend**:
   ```sh
   cd backend
   cp .env.example .env   # fill in the real payment gateway sandbox keys
   npm install
   npm run db:migrate     # creates the schema
   npm run db:seed        # seeds the one dummy product
   npm run start:dev      # http://localhost:3000 — Swagger at /api/docs
   ```
3. **Frontend**:
   ```sh
   cd frontend
   cp .env.example .env.local   # fill in the same sandbox public key/API URL
   npm install
   npm run dev             # http://localhost:5173
   ```
   In dev, the frontend and backend run on different ports/origins, unlike
   production (same origin behind CloudFront) — `vite.config.ts` proxies `/api`
   to `http://localhost:3000` so `fetchBaseQuery`'s relative `/api/*` calls
   still work locally without any code change.
4. **Running the backend test suite**: it needs its own database (some tests
   truncate every table between cases) — `cp backend/.env.test.example
   backend/.env.test`, then `npm run db:test:setup` (creates `checkout_test` and
   applies migrations to it) once. After that, `npm test` never touches the
   database from step 2.

## Tests and coverage

Each app has its own suite and an 80% coverage gate (`coverageThreshold` in its
Jest config) — CI to enforce it on every PR is still pending, see ADR 0001.
- `cd backend && npm run test:cov` (see step 4 above for the one-time test DB
  setup first) / `npm run test:e2e`.
- `cd frontend && npm run test:cov`.

## Deployment

_Pending — link to the app deployed on AWS._

## API documentation

Interactive Swagger UI, generated directly from the backend's DTOs and
controllers (not hand-maintained): once the backend is running, visit
`/api/docs` (e.g. `http://localhost:3000/api/docs`). The raw OpenAPI JSON is at
`/api/docs-json`. See [API-CONTRACT.md](specs/API-CONTRACT.md) for the
narrative version (error codes, business rules, idempotency).
