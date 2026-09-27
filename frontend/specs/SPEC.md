# Frontend — Spec

Scope of the frontend app specifically. Runs standalone (own `package.json`,
Dockerfile, tests, env vars — no imports from `backend/` or `infra/`, per ADR 0001).
Functional source of truth: [../../specs/PRD.md](../../specs/PRD.md),
[../../specs/API-CONTRACT.md](../../specs/API-CONTRACT.md),
[../../specs/ARD.md](../../specs/ARD.md). This file restates what's frontend-specific
and adds validation detail the shared specs don't cover.

## Screens (1:1 with the PRD's 5-step flow)

| # | Screen | Requirement |
|---|---|---|
| 1 | Product page | Name, description, price (tax-included), stock, image. "Pay with credit card" button, disabled/labeled when `stock = 0` |
| 2 | Card / delivery info | Modal: card number, expiry, CVC, cardholder name (validated) + delivery address fields. Brand detection (VISA/MasterCard) is a plus |
| 3 | Summary (backdrop) | Unit price × quantity, IVA, base fee, delivery fee, total. Payment button |
| 4 | Final status | Approved / declined / error, using the gateway's decline/error reason when present |
| 5 | Back to product page | Stock reflects the just-completed purchase |

## Card validation (client-side, before tokenization)

| Field | Rule |
|---|---|
| Number | Luhn check; length per brand (13–19 digits) |
| Brand detection | VISA: starts with `4`. MasterCard: `51`–`55` or `2221`–`2720` prefix |
| Expiry | `MM/YY`, not in the past |
| CVC | 3 digits (4 for brands that use it — not relevant for VISA/MasterCard) |
| Cardholder name | Non-empty |

Card data is fake (sandbox) but must pass these structural checks — the point is
validating shape, not verifying a real card.

## Resiliency (PRD requirement)

A refresh at any point in the flow must resume at the same `step`, not restart. See
[ARD.md](../../specs/ARD.md) for the Redux slice and persistence whitelist — no card
data is ever persisted.

## Non-functional

- Mobile-first, responsive down to iPhone SE (2020) — 375×667 CSS px (the PRD's
  "1334×750" is the device's physical pixel resolution in landscape; the CSS
  viewport to design against is 375×667 portrait).
- Jest + React Testing Library, coverage threshold **80%**.
- TailwindCSS for styling (ADR 0001).
- ErrorBoundary + Sentry (ADR 0001).

## Out of scope

- Product listing/catalog (stretch goal only, see PRD.md).
- Any form of authentication/account.
