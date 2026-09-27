# Backend — Technical Design

Concrete implementation of the layering defined in
[../../specs/ARD.md](../../specs/ARD.md).

## Stack

| Concern | Choice |
|---|---|
| Framework | NestJS 11 (kept CommonJS — see the backend scaffold PR: Nest's current CLI defaults to an ESM-only template that doesn't pair well with Jest yet) |
| ORM | Prisma 7 (Postgres), pinned to the last stable release (`7.10.0`) — `npm install prisma` resolves to an `8.0.0-rc` pre-release by default, don't let it drift there |
| Result/ROP | `neverthrow` (`Result`, `ResultAsync`, `.andThen`, `.match`) |
| Validation | `class-validator` + `class-transformer` on DTOs |
| HTTP client (gateway) | `axios` via Nest's `HttpModule`, wrapped with `ResultAsync.fromPromise` |
| Logging | `nestjs-pino`, redacting `cardToken`, `email`, `address.*` |
| Errors/monitoring | `@sentry/node`, `beforeSend` redaction (same fields) |
| API docs | `@nestjs/swagger`, generated from the same DTOs (feeds the README requirement) |
| Tests | Jest, `coverageThreshold` 80% global in `jest.config.js` |

## Folder structure

```
backend/
  src/
    checkout/
      domain/
        entities/          # Product, Transaction, Customer, Delivery, Payment
        value-objects/      # Money
        errors/              # OutOfStock, PaymentDeclined, GatewayError, InvalidTransition, ...
      ports/
        inbound/            # TransactionsPort, ProductsPort
        outbound/            # ProductRepository, TransactionRepository, PaymentGatewayPort
                             # (customers/deliveries/payments have no repository of
                             # their own — see ARD.md; TransactionRepository reads
                             # them joined via findByIdWithDetails)
      application/
        transactions.service.ts   # implements TransactionsPort
        products.service.ts        # implements ProductsPort
      infrastructure/
        prisma/                    # Prisma-based repository adapters
        gateway/                   # HttpPaymentGatewayAdapter
      interface/
        http/
          products.controller.ts
          transactions.controller.ts
          health.controller.ts
          dto/
    shared/
      result/                # small neverthrow helpers if needed
      logger/
      sentry/
    main.ts
  prisma/
    schema.prisma
    seed.ts
    migrations/
  prisma.config.ts            # Prisma 7 moved the datasource connection here
                               # (schema.prisma's datasource no longer takes `url`)
  test/                      # test doubles: in-memory fakes for outbound ports
  Dockerfile
  .env.example
```

## Prisma config (7.x — different from older Prisma versions)

Prisma 7 removed `url = env("DATABASE_URL")` from `schema.prisma`'s `datasource`
block. Two things replace it:

1. `prisma.config.ts` at the backend root, used by the CLI (migrate/seed/studio):
   ```ts
   import 'dotenv/config';
   import { defineConfig, env } from 'prisma/config';

   export default defineConfig({
     schema: 'prisma/schema.prisma',
     datasource: { url: env('DATABASE_URL') },
     migrations: { seed: 'node --require ts-node/register prisma/seed.ts' },
   });
   ```
2. At runtime, `new PrismaClient()` **no longer reads `DATABASE_URL` implicitly** —
   it requires a driver adapter (`@prisma/adapter-pg` + `pg`):
   ```ts
   import { PrismaPg } from '@prisma/adapter-pg';
   import { PrismaClient } from '@prisma/client';

   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   const prisma = new PrismaClient({ adapter });
   ```
   Every Prisma-based repository adapter in `infrastructure/prisma/` constructs (or
   is injected) a client built this way — there's no implicit connection anymore.

## Prisma schema (maps [DATA-MODEL.md](../../specs/DATA-MODEL.md) 1:1)

Column/table names use `@map`/`@@map` to snake_case (matching DATA-MODEL.md exactly)
while keeping camelCase field names in the generated client. `CHECK` constraints
(`products.stock >= 0`, `transactions.quantity >= 1`) aren't expressible in Prisma's
schema DSL — they're hand-added to the generated migration SQL once, not something
this block shows.

```prisma
enum TransactionStatus {
  PENDING
  APPROVED
  DECLINED
  ERROR
  VOIDED
}

model Product {
  id              String        @id @default(uuid())
  name            String
  description     String
  unitPriceAmount Int           @map("unit_price_amount")
  taxRate         Decimal       @map("tax_rate") @db.Decimal(5, 4)
  stock           Int
  imageUrl        String?       @map("image_url")
  isFeatured      Boolean       @default(false) @map("is_featured")
  currency        String        @default("COP")
  transactions    Transaction[]

  @@map("products")
}

model Customer {
  id           String        @id @default(uuid())
  firstName    String        @map("first_name")
  lastName     String        @map("last_name")
  email        String        @unique
  phone        String
  transactions Transaction[]

  @@map("customers")
}

model Transaction {
  id                String            @id @default(uuid())
  reference         String            @unique
  idempotencyKey    String            @unique @map("idempotency_key")
  productId         String            @map("product_id")
  product           Product           @relation(fields: [productId], references: [id])
  customerId        String            @map("customer_id")
  customer          Customer          @relation(fields: [customerId], references: [id])
  status            TransactionStatus @default(PENDING)
  quantity          Int
  unitPriceAmount   Int               @map("unit_price_amount")
  subtotalAmount    Int               @map("subtotal_amount")
  taxRate           Decimal           @map("tax_rate") @db.Decimal(5, 4)
  taxAmount         Int               @map("tax_amount")
  productAmount     Int               @map("product_amount")
  baseFeeAmount     Int               @map("base_fee_amount")
  deliveryFeeAmount Int               @map("delivery_fee_amount")
  totalAmount       Int               @map("total_amount")
  currency          String            @default("COP")
  delivery          Delivery?
  payment           Payment?
  createdAt         DateTime          @default(now()) @map("created_at")
  updatedAt         DateTime          @updatedAt @map("updated_at")

  @@map("transactions")
}

model Delivery {
  id            String      @id @default(uuid())
  transactionId String      @unique @map("transaction_id")
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  address       String
  city          String
  region        String?
  postalCode    String?     @map("postal_code")
  notes         String?

  @@map("deliveries")
}

model Payment {
  id               String      @id @default(uuid())
  transactionId    String      @unique @map("transaction_id")
  transaction      Transaction @relation(fields: [transactionId], references: [id])
  cardLast4        String?     @map("card_last4")
  cardBrand        String?     @map("card_brand")
  gatewayReference String?     @map("gateway_reference")
  declineReason    String?     @map("decline_reason")
  errorReason      String?     @map("error_reason")

  @@map("payments")
}
```

`status` stays a native Prisma/Postgres enum (see ADR 0001) — the 5 states are fixed
and coupled to code, not data-driven.

## Ports — signatures

```ts
// ports/inbound/transactions.port.ts
interface TransactionsPort {
  create(cmd: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError>;
  getById(id: string): ResultAsync<TransactionDetail, TransactionNotFound | RepositoryError>;
}
type CreateTransactionError =
  | ValidationError | ProductNotFound | OutOfStock | PaymentDeclined | GatewayError
  | InvalidTransition | RepositoryError;

// ports/inbound/products.port.ts
interface ProductsPort {
  getCurrent(): ResultAsync<Product, ProductNotFound>;
}

// ports/outbound/transaction.repository.ts
interface TransactionRepository {
  findByIdempotencyKey(key: string): ResultAsync<Transaction | null, RepositoryError>;
  createPending(data: NewTransaction): ResultAsync<Transaction, OutOfStock | RepositoryError>;
  updateResult(id: string, result: TransactionResult): ResultAsync<Transaction, InvalidTransition | RepositoryError>;
  findById(id: string): ResultAsync<Transaction, TransactionNotFound | RepositoryError>;
  // Joins customer + delivery + payment in one Prisma `include` read — see ARD.md
  // for why those three don't get their own repository.
  findByIdWithDetails(id: string): ResultAsync<TransactionDetail, TransactionNotFound | RepositoryError>;
}

// ports/outbound/payment-gateway.port.ts
interface PaymentGatewayPort {
  charge(req: ChargeRequest): ResultAsync<ChargeResult, PaymentDeclined | GatewayError>;
}
```

## `TransactionsService.create` — ROP chain

1. `findByIdempotencyKey` → if found, short-circuit and return it (idempotency).
2. `createPending` → atomic `stock -= quantity WHERE stock >= quantity` + find-or-create
   `customers` by email (never overwriting an existing match — no auth to verify
   ownership of that email) + insert `deliveries`, `transactions` (PENDING) in one DB
   transaction. 0 rows affected on the stock update → `OutOfStock`.
3. `PaymentGatewayPort.charge` with the tokenized card.
4. On success: `updateResult` → `APPROVED`/`DECLINED`, write the `payments` row.
5. On `DECLINED` or a thrown/technical failure (→ `ERROR`): `updateResult` +
   restore stock (`stock += quantity`) in the same DB transaction as the status
   update, so a crash between them can't leave stock wrong.

Each arrow is a `.andThen`; the whole chain is one `ResultAsync`, matching ADR 0001.

## Config (env vars)

`DATABASE_URL`, `PAYMENT_API_URL`, `PAYMENT_PRIVATE_KEY`,
`PAYMENT_INTEGRITY_SECRET`, `BASE_FEE_AMOUNT`, `DELIVERY_FEE_AMOUNT`, `PORT`,
`SENTRY_DSN`, `LOG_LEVEL`. All in `.env.example` with placeholder values only.
`main.ts` loads `.env` itself (`import 'dotenv/config'`) so `npm run start:dev`
works standalone against the Dockerized Postgres, without needing the vars
exported in the shell — harmless in the actual container, where Docker Compose's
`env_file` already sets real env vars and dotenv never overrides an existing one.

## Bootstrap (`main.ts`)

- Global prefix `/api`, except `GET /health` (stays unauthenticated and reachable
  directly, per ADR 0001 / API-CONTRACT.md).
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) with a
  custom `exceptionFactory` — otherwise a DTO validation failure returns Nest's
  own default shape (`{message, error, statusCode}`), not the project's error
  envelope. It flattens nested (`@ValidateNested`) errors into a dotted-path
  `details` map, e.g. `"customer.email": ["email must be an email"]`.
- `CheckoutModule` wires every port to its adapter (`useClass`, keyed by the
  ports' Symbol tokens) — see `checkout.module.ts`. `HttpModule` (from
  `@nestjs/axios`) is imported there for `HttpPaymentGatewayAdapter`.
- `helmet()` for baseline security headers (HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, CSP, etc. — same OWASP list as CloudFront's response
  headers policy in infra/specs/SPEC.md; this covers it at the origin too).
- `initSentry()` runs before the app is even created — `Sentry.init` just needs
  `SENTRY_DSN` in `process.env`; an empty/unset DSN makes the SDK a safe no-op.
- `app.useLogger(app.get(Logger))`, with `bufferLogs: true` on `NestFactory.create`
  so bootstrap logs (before the logger is wired) aren't lost to the console.

## Cross-cutting: logging, redaction, correlation id, error monitoring

- `shared/logger/pino.config.ts`: `LoggerModule.forRoot(pinoConfig)` (imported in
  `AppModule`, not `CheckoutModule` — it's app-wide, not checkout-specific).
  - `redact`: exact dot-paths, censoring to `[Redacted]` — `cmd.cardToken`,
    `cmd.paymentAcceptanceToken`, `cmd.customer.email`, `cmd.customer.phone`,
    `cmd.delivery.address`, `req.headers.authorization`. The `cmd.*` paths match
    the one deliberate log call that exists today (`TransactionsController.create`
    logs the incoming command at `debug` for troubleshooting) — pino's redact
    needs the exact shape of whatever gets logged, so this list grows whenever a
    new log call introduces a new sensitive shape.
  - `genReqId`: reuses an inbound `X-Request-Id` header when present (so a
    request stays correlated across CloudFront/ALB and this service's own logs),
    otherwise mints a UUID. Every log line for that request carries it as `req.id`
    — that's the correlation id, no extra middleware needed.
- `shared/sentry/sentry.bootstrap.ts`: `initSentry()` wires `beforeSend` to
  `redactSensitiveData`, a recursive walker (not exact paths, unlike pino) that
  strips the same PII categories (`cardToken`, `paymentAcceptanceToken`, `email`,
  `phone`, `address`) wherever they appear in a Sentry event's shape, which is
  far less predictable than a single log call's payload.
- `shared/sentry/sentry-exception.filter.ts`: a global `@Catch()` filter.
  Domain errors already arrive as a well-formed `HttpException` (from
  `http-error.mapper.ts`) — those are expected outcomes, passed straight
  through. Anything else is an actual bug that escaped the `Result`/ROP chain;
  that's the only case reported to `Sentry.captureException`, and the client
  still only ever sees a generic 500 (`INTERNAL_ERROR`), never the real
  exception — same "no raw exception to the client" rule as `GATEWAY_ERROR`.

## A build gotcha worth knowing

`tsconfig.build.json` inherits `incremental: true` from the base config. Its
default `.tsbuildinfo` location is the project root, **outside** `dist/` — so
`nest-cli.json`'s `deleteOutDir` wipes `dist/` on every build but never touches
that cache file. TypeScript then trusts the stale cache and believes a wiped
build is already up to date, silently emitting nothing (`nest build` exits 0,
no errors, no `dist/`). Fixed by pointing `tsBuildInfoFile` inside `dist/`
(`tsconfig.build.json`), so it gets deleted right along with everything else.

## Testing strategy

- `domain`: pure unit tests, no doubles needed (e.g. `Transaction.transitionTo`
  rejecting an invalid transition).
- `application`: unit tests against **in-memory fakes** implementing the outbound
  ports (no DB, no HTTP) — covers the full `create` chain for
  approved/declined/error/out-of-stock/idempotent-retry paths without mocking
  frameworks.
- `infrastructure`: Prisma repositories are tested against a **real** local/CI
  Postgres (`--runInBand`, since these spec files share one DB and can't run as
  parallel workers) — mocking `$transaction(async (tx) => ...)` faithfully is
  fragile and wouldn't verify the atomic stock-reservation query actually works.
  `HttpPaymentGatewayAdapter` is tested against a mocked `axios`, verifying the
  exception→`Result` conversion (no real network call needed there).
- `interface`: controller tests verifying the exhaustive switch maps each domain
  error to the right HTTP status.
- `jest.config.js`: `coverageThreshold.global` at 80% for branches/functions/lines/
  statements — CI fails the PR otherwise (ADR 0001).
