# Backend — Technical Design

Concrete implementation of the layering defined in
[../../specs/ARD.md](../../specs/ARD.md).

## Stack

| Concern | Choice |
|---|---|
| Framework | NestJS + TypeScript |
| ORM | Prisma (Postgres) |
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
        outbound/            # ProductRepository, CustomerRepository, DeliveryRepository,
                             # TransactionRepository, PaymentRepository, PaymentGatewayPort
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
  test/                      # test doubles: in-memory fakes for outbound ports
  Dockerfile
  .env.example
```

## Prisma schema (maps [DATA-MODEL.md](../../specs/DATA-MODEL.md) 1:1)

```prisma
enum TransactionStatus {
  PENDING
  APPROVED
  DECLINED
  ERROR
  VOIDED
}

model Product {
  id              String   @id @default(uuid())
  name            String
  description     String
  unitPriceAmount Int
  taxRate         Decimal  @db.Decimal(5, 4)
  stock           Int
  imageUrl        String?
  isFeatured      Boolean  @default(false)
  currency        String   @default("COP")
  transactions    Transaction[]
}

model Customer {
  id           String   @id @default(uuid())
  firstName    String
  lastName     String
  email        String
  phone        String
  transactions Transaction[]
}

model Transaction {
  id                String            @id @default(uuid())
  reference         String            @unique
  idempotencyKey    String            @unique
  productId         String
  product           Product           @relation(fields: [productId], references: [id])
  customerId        String
  customer          Customer          @relation(fields: [customerId], references: [id])
  status            TransactionStatus @default(PENDING)
  quantity          Int
  unitPriceAmount   Int
  subtotalAmount    Int
  taxRate           Decimal           @db.Decimal(5, 4)
  taxAmount         Int
  productAmount     Int
  baseFeeAmount     Int
  deliveryFeeAmount Int
  totalAmount       Int
  currency          String            @default("COP")
  delivery          Delivery?
  payment           Payment?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
}

model Delivery {
  id            String      @id @default(uuid())
  transactionId String      @unique
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  address       String
  city          String
  region        String?
  postalCode    String?
  notes         String?
}

model Payment {
  id              String      @id @default(uuid())
  transactionId   String      @unique
  transaction     Transaction @relation(fields: [transactionId], references: [id])
  cardLast4       String?
  cardBrand       String?
  gatewayReference String?
  declineReason   String?
  errorReason     String?
}
```

`status` stays a native Prisma/Postgres enum (see ADR 0001) — the 5 states are fixed
and coupled to code, not data-driven.

## Ports — signatures

```ts
// ports/inbound/transactions.port.ts
interface TransactionsPort {
  create(cmd: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError>;
  getById(id: string): ResultAsync<Transaction, TransactionNotFound>;
}
type CreateTransactionError =
  | ProductNotFound | OutOfStock | PaymentDeclined | GatewayError | ValidationError;

// ports/inbound/products.port.ts
interface ProductsPort {
  getCurrent(): ResultAsync<Product, ProductNotFound>;
}

// ports/outbound/*.repository.ts — one per entity, e.g.:
interface TransactionRepository {
  findByIdempotencyKey(key: string): ResultAsync<Transaction | null, RepositoryError>;
  createPending(data: NewTransaction): ResultAsync<Transaction, OutOfStock | RepositoryError>;
  updateResult(id: string, result: TransactionResult): ResultAsync<Transaction, InvalidTransition | RepositoryError>;
}

// ports/outbound/payment-gateway.port.ts
interface PaymentGatewayPort {
  charge(req: ChargeRequest): ResultAsync<ChargeResult, PaymentDeclined | GatewayError>;
}
```

## `TransactionsService.create` — ROP chain

1. `findByIdempotencyKey` → if found, short-circuit and return it (idempotency).
2. `createPending` → atomic `stock -= quantity WHERE stock >= quantity` + insert
   `customers`, `deliveries`, `transactions` (PENDING) in one DB transaction. 0 rows
   affected on the stock update → `OutOfStock`.
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

## Testing strategy

- `domain`: pure unit tests, no doubles needed (e.g. `Transaction.transitionTo`
  rejecting an invalid transition).
- `application`: unit tests against **in-memory fakes** implementing the outbound
  ports (no DB, no HTTP) — covers the full `create` chain for
  approved/declined/error/out-of-stock/idempotent-retry paths without mocking
  frameworks.
- `infrastructure`: narrower tests per adapter — Prisma repositories against a test
  DB or mocked client (whichever keeps CI fast), `HttpPaymentGatewayAdapter` against
  a mocked `axios` verifying the exception→`Result` conversion.
- `interface`: controller tests verifying the exhaustive switch maps each domain
  error to the right HTTP status.
- `jest.config.js`: `coverageThreshold.global` at 80% for branches/functions/lines/
  statements — CI fails the PR otherwise (ADR 0001).
