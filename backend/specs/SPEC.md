# Backend — Spec

Scope of the backend app specifically. Runs standalone (own `package.json`,
Dockerfile, tests, env vars — no imports from `frontend/` or `infra/`, per ADR 0001).
Functional source of truth: [../../specs/PRD.md](../../specs/PRD.md),
[../../specs/API-CONTRACT.md](../../specs/API-CONTRACT.md),
[../../specs/DATA-MODEL.md](../../specs/DATA-MODEL.md),
[../../specs/ARD.md](../../specs/ARD.md). This file only restates what's
backend-specific and adds validation detail the shared specs don't cover.

## Must implement

- `GET /health`
- `GET /products/current`
- `POST /transactions`
- `GET /transactions/:id`

(exact request/response shapes: [API-CONTRACT.md](../../specs/API-CONTRACT.md))

## Entities owned

`products`, `customers`, `deliveries`, `transactions`, `payments` — schema in
[DATA-MODEL.md](../../specs/DATA-MODEL.md). No create endpoint for `products`
(seeded only, per the brief).

## Validation (real-life scenarios, per PRD)

| Scenario | Handling |
|---|---|
| Unknown/malformed `productId` | `PRODUCT_NOT_FOUND` (404) |
| `quantity < 1` or non-integer | `VALIDATION_ERROR` (400), rejected before touching stock |
| Requested `quantity` > available stock | `OUT_OF_STOCK` (409), atomic reservation fails, gateway never called |
| Missing/invalid `cardToken` format | `VALIDATION_ERROR` (400) |
| Invalid `customer.email` / missing required fields | `VALIDATION_ERROR` (400) |
| Double submit (same `idempotencyKey` retried) | Returns the existing transaction, no new reservation |
| Already-resolved transaction re-submitted with a new key but same intent | Out of scope to detect (no accounts to correlate "same intent"); idempotency key is the only guard, as documented in API-CONTRACT.md |
| Gateway unreachable / timeout / 5xx | `GATEWAY_ERROR` (502), transaction → `ERROR`, stock restored |
| Gateway responds "declined" | `PAYMENT_DECLINED` (422), transaction → `DECLINED`, stock restored |
| `GET /transactions/:id` with unknown id | `TRANSACTION_NOT_FOUND` (404) |

## Non-functional

- Jest unit tests, coverage threshold **80%**, enforced by CI (see
  [infra/specs/SPEC.md](../../infra/specs/SPEC.md)).
- PAN/CVC never accepted by any endpoint — if a request body ever contains
  card-number-shaped data outside `cardToken`, that's a validation bug, not a
  feature to build defenses around (the frontend never sends it).
- Secrets (gateway private key, integrity secret, DB credentials) only via env vars,
  never committed (`.env.example` has placeholder keys only).
- Structured logs (pino) redact `cardToken`, `email`, `address`. Sentry `beforeSend`
  applies the same redaction.

## Out of scope

- Auth / accounts (PRD).
- Product create/update/delete endpoints (PRD — seed only).
- Delivery tracking/status beyond what's stored in `deliveries` (DATA-MODEL.md).
