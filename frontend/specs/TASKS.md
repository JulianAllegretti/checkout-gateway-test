# Frontend — Tasks

Suggested order, one feature branch/PR per numbered task (or grouped adjacent
tasks), targeting `release/first-release`.

1. **Scaffold**: Vite + React + TS, Tailwind config, ESLint/Prettier, Jest + RTL
   config with the 80% coverage gate, Redux store + `redux-persist` wired up (empty
   slice), `Dockerfile` (build-only), `.env.example`.
2. **`checkoutSlice`**: state shape per TDD.md, reducers/actions, persistence
   whitelist. Unit tests (step only advances, no card fields in the type).
3. **`schemas.ts`**: Zod schemas for card/customer/delivery (Luhn, brand detection,
   expiry/CVC as `.refine()`s). Table-driven unit tests.
4. **API layer**: RTK Query `api.ts` (`getCurrentProduct`, `createTransaction`,
   `getTransaction` with conditional polling) + `gatewayClient.ts` (tokenization,
   calls the gateway directly). Mocked-fetch tests for both.
5. **Screen 1 — Product page**: renders product/stock/price, disabled state when
   `stock = 0`, "Pay with credit card" CTA. Tests: happy path + out-of-stock.
6. **Screen 2 — Payment modal**: `CardForm` + `DeliveryForm` with
   `react-hook-form` + `zodResolver(cardSchema)`, brand logo display. Tests: valid
   submit, each validation error.
7. **Screen 3 — Summary backdrop**: fee breakdown (unit price, IVA, base fee,
   delivery fee, total) from `productSnapshot` + fixed fees, payment button →
   `createTransaction` with a stable `idempotencyKey`. Tests: math is correct,
   button disabled while pending.
8. **Screen 4 — Final status**: renders approved/declined/error with the reason,
   polls while `PENDING`. Tests: each status branch.
9. **Screen 5 — Back to product page**: resets `checkoutSlice`, re-fetches
   `getCurrentProduct` so stock is current.
10. **Cross-cutting**: `ErrorBoundary` + Sentry bootstrap (with redaction),
    generic-error fallback UI for unmapped `errorCode`s.
11. **Responsive pass**: verify all 5 screens at 375×667 (iPhone SE 2020 CSS
    viewport) and at least one larger breakpoint, fix overflow/out-of-bounds
    issues (rubric item).
12. **Coverage check**: run full suite, confirm ≥80%, fix gaps.
