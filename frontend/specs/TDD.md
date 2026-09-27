# Frontend — Technical Design

Concrete implementation of the frontend architecture defined in
[../../specs/ARD.md](../../specs/ARD.md).

## Stack

| Concern | Choice |
|---|---|
| Build | Vite + React + TypeScript |
| State | Redux Toolkit (`createSlice`) + `redux-persist` |
| Data fetching | RTK Query — its built-in `pollingInterval` covers polling `GET /transactions/:id` while `status = PENDING` for free |
| Styling | TailwindCSS (ADR 0001) |
| Interactive primitives | `@headlessui/react` (`Dialog`/`Transition`) for the payment modal (screen 2) and the summary backdrop (screen 3) — accessible (focus trap, ESC, ARIA) and unstyled, pairs directly with Tailwind |
| Routing | None. A single route; screens are conditionally rendered from `checkoutSlice.step`. Simpler than routing given the flow is strictly sequential and state already drives resiliency |
| Forms | `react-hook-form` + `zod` (via `@hookform/resolvers/zod`) — the schema is the single source of truth for both validation and the form's TypeScript types (`z.infer`) |
| Tests | Jest + React Testing Library, `coverageThreshold` 80% |
| Errors/monitoring | `@sentry/react`, `ErrorBoundary` |

## Folder structure

```
frontend/
  src/
    app/
      store.ts              # Redux store + persist config
    features/
      checkout/
        checkoutSlice.ts      # step, productSnapshot, transactionId, reference,
                               # status, customerDraft, deliveryDraft, error
        api.ts                 # RTK Query: getCurrentProduct, createTransaction,
                               # getTransaction (polling)
        schemas.ts            # Zod schemas: cardSchema, customerSchema,
                               # deliverySchema — Luhn/brand/expiry as .refine()
    pages/
      ProductPage.tsx
      FinalStatusPage.tsx
    components/
      checkout/
        PaymentModal.tsx       # CardForm + DeliveryForm, Headless UI Dialog
        SummaryBackdrop.tsx    # Headless UI Dialog styled as a bottom sheet
    lib/
      gatewayClient.ts        # tokenizes the card directly with the gateway
                              # (public key), NEVER goes through our API
      sentry.ts
    App.tsx
  Dockerfile                  # build-only: produces /dist, not run in prod
                               # (deploy is S3 + CloudFront, see infra/specs)
  .env.example
```

## Redux slice (per ARD.md)

`customerDraft`/`deliveryDraft` types are `z.infer<typeof customerSchema>` /
`z.infer<typeof deliverySchema>` from `schemas.ts` — not redeclared by hand.

```ts
interface CheckoutState {
  step: 1 | 2 | 3 | 4 | 5;
  productSnapshot: Product | null;
  quantity: number;
  customerDraft: CustomerDraft | null;   // z.infer<typeof customerSchema>
  deliveryDraft: DeliveryDraft | null;   // z.infer<typeof deliverySchema>
  transactionId: string | null;
  reference: string | null;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | null;
  errorReason: string | null;
}
```

`redux-persist` whitelist: exactly the fields above. Card number/CVC/`cardToken`
never enter this slice — they live in `PaymentModal`'s local `react-hook-form` state
and are discarded once `gatewayClient.tokenize()` resolves.

## Gateway tokenization client

`lib/gatewayClient.ts` calls the gateway's public endpoints directly (not our
backend), using `VITE_PAYMENT_API_URL` and `VITE_PAYMENT_PUBLIC_KEY` (generic names
per ADR 0001 — never the real gateway name in code). Returns `{ cardToken,
brand, last4 }` for local display use (brand/last4 can be safely dropped into
Redux later if we want them on the final status screen — they're not sensitive).

## Our API client (RTK Query)

`features/checkout/api.ts`, matching [API-CONTRACT.md](../../specs/API-CONTRACT.md):

- `getCurrentProduct: builder.query<Product, void>` → `GET /products/current`.
- `createTransaction: builder.mutation<TransactionResult, CreateTransactionRequest>`
  → `POST /transactions`. `idempotencyKey` generated client-side (`crypto.randomUUID()`)
  once per checkout attempt and reused on retry (network failure, not a fresh
  submit) so a retried request can't double-charge or double-reserve stock.
- `getTransaction: builder.query<TransactionResult, string>` → `GET /transactions/:id`,
  with `pollingInterval` active only while `status === 'PENDING'`.

## Error handling

API error envelope (`errorCode`, `message`) maps to a small dictionary of
user-facing copy per `errorCode` (`OUT_OF_STOCK`, `PAYMENT_DECLINED`,
`GATEWAY_ERROR`, `VALIDATION_ERROR`, ...), rendered on the screen where it's
relevant (stock/validation errors on screens 2–3, payment outcome on screen 4).
Anything unexpected (network failure, 5xx we didn't model) falls back to a generic
message + the `ErrorBoundary`/Sentry report.

## Env vars

`VITE_PAYMENT_API_URL`, `VITE_PAYMENT_PUBLIC_KEY`, `VITE_SENTRY_DSN`. No
`VITE_API_BASE_URL` needed — the frontend and `/api/*` share an origin behind
CloudFront (ADR 0001), so requests to our backend are relative.

## Testing strategy

- `checkoutSlice`: reducer unit tests (step only moves forward, persistence
  whitelist doesn't leak card fields by construction — the type doesn't have them).
- `schemas.ts`: table-driven unit tests against `cardSchema.safeParse(...)` (Luhn
  valid/invalid, brand detection per prefix, expiry edge cases).
- Components: React Testing Library, one test file per screen/component, covering
  the happy path and at least one error path per screen (out-of-stock on screen 1,
  invalid card on screen 2, declined/error on screen 4).
- `api.ts`: RTK Query handlers tested with a mocked fetch (msw or manual mocks).
