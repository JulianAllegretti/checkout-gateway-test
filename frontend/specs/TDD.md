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
      storage.ts            # redux-persist's localStorage engine, reimplemented
                             # in-house — see its own comment for why
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

`lib/gatewayClient.ts` calls the gateway's public tokenization endpoint directly
(not our backend), using `VITE_PAYMENT_API_URL` and `VITE_PAYMENT_PUBLIC_KEY`
(generic names per ADR 0001 — never the real gateway name in code). Returns
`{ cardToken, brand, last4 }` for local display use (brand/last4 can be safely
dropped into Redux later if we want them on the final status screen — they're not
sensitive). It does **not** fetch the habeas-data consent tokens the same way —
the gateway's merchant-info endpoint has no browser CORS support, confirmed
empirically (a direct call fails with a missing `Access-Control-Allow-Origin`
error), so those come from our own backend instead — see `api.ts` below.

## Our API client (RTK Query)

`features/checkout/api.ts`, matching [API-CONTRACT.md](../../specs/API-CONTRACT.md):

- `getCurrentProduct: builder.query<Product, void>` → `GET /products/current`.
- `getAcceptanceTokens: builder.query<AcceptanceTokens, void>` →
  `GET /payment/acceptance-tokens`. Called when `PaymentModal` mounts (not on
  submit) so the two consent checkboxes and their contract links are ready as soon
  as the form renders.
- `createTransaction: builder.mutation<TransactionResult, CreateTransactionRequest>`
  → `POST /transactions`. `idempotencyKey` generated client-side (`crypto.randomUUID()`)
  once per checkout attempt and reused on retry (network failure, not a fresh
  submit) so a retried request can't double-charge or double-reserve stock. The
  request body carries both `paymentAcceptanceToken` and `personalDataAuthToken`
  from the query above. This call can take up to roughly a minute in the worst
  case — the backend polls the gateway internally until the charge resolves (see
  API-CONTRACT.md) — `PaymentModal`/`SummaryBackdrop`'s existing loading states
  already cover an ordinary wait, just a longer one.
- `getTransaction: builder.query<TransactionResult, string>` → `GET /transactions/:id`,
  with `pollingInterval` active only while `status === 'PENDING'`.

## Error handling

Two different things can go wrong with `POST /transactions`, surfaced two different
ways (see API-CONTRACT.md):
- The request itself is rejected (`errorCode`/`message` error envelope: e.g.
  `OUT_OF_STOCK`, `VALIDATION_ERROR`) — no transaction was created. A small
  dictionary maps `errorCode` to user-facing copy, rendered on screen 3 where the
  request was made.
- The request succeeds (`201`) but the charge itself was declined or technically
  failed — this is `status: 'DECLINED' | 'ERROR'` plus `reason` in the response
  body, not an error at all from RTK Query's point of view. Screen 4 renders this
  from `checkoutSlice.status`/`errorReason`, not from an error dictionary.

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
