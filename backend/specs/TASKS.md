# Backend — Tasks

Suggested order, one feature branch/PR per numbered task (or grouped adjacent tasks),
targeting `release/first-release`. Each should leave `main`/`release` buildable and
tested — no half-finished task merged.

1. **Scaffold**: NestJS project, TypeScript config, ESLint/Prettier, `jest.config.js`
   with the 80% coverage gate, `Dockerfile` (skeleton), `.env.example`.
2. **Prisma**: `schema.prisma` (per TDD.md), first migration, `prisma/seed.ts` with
   a few dummy products (exactly one `isFeatured: true`).
3. **Domain**: entities, `Money` value object, error classes, `Transaction.transitionTo`
   state machine — unit tests for the state machine's valid/invalid transitions.
4. **Ports**: inbound (`TransactionsPort`, `ProductsPort`) and outbound (repositories,
   `PaymentGatewayPort`) interfaces — no implementation yet, just contracts.
5. **Infrastructure — Prisma repositories**: implement the outbound repository
   ports, including the atomic stock reservation/restore queries. Unit tests.
6. **Infrastructure — gateway adapter**: `HttpPaymentGatewayAdapter` implementing
   `PaymentGatewayPort`, converting axios exceptions/timeouts into `GatewayError`.
   Unit tests with a mocked HTTP client, including a timeout/5xx case.
7. **Application — Products**: `ProductsService.getCurrent`. Unit tests with a fake
   `ProductRepository`.
8. **Application — Transactions**: `TransactionsService.create` (the full ROP chain)
   and `getById`. Unit tests with fake outbound ports covering: approved, declined,
   gateway error, out-of-stock, idempotent retry, invalid quantity.
9. **Interface**: DTOs with `class-validator`, `ProductsController`,
   `TransactionsController`, `HealthController`, the exhaustive error→HTTP switch.
   Controller-level tests asserting status codes per error type.
10. **Cross-cutting**: pino logger + redaction + correlation id, Sentry bootstrap
    with `beforeSend` redaction, `helmet` baseline headers.
11. **API docs**: wire `@nestjs/swagger` off the existing DTOs, expose
    `/api/docs` (or export the JSON for a public Postman collection — whichever
    goes in the README per the PRD's rubric item).
12. **Coverage check**: run full suite, confirm ≥80%, fix gaps before moving to
    frontend integration.
