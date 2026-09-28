# PRD — Payment Gateway Checkout

## Summary

An app to purchase a product paying by credit card through an external payment
gateway (sandbox mode only, no real money involved). See architecture decisions in
[decisions/0001-architecture-overview.md](decisions/0001-architecture-overview.md).

## Business flow (5 screens)

1. **Product page**: shows the product, description, price and available stock.
   "Pay with credit card" button.
2. **Credit card / delivery info** (modal or screen): validated card data (number,
   expiration, CVC, cardholder name; VISA/MasterCard brand detection is a plus) plus
   customer delivery information. Card data is fake but must follow the real
   structure of a credit card. Also requires two checkboxes (terms and conditions;
   personal data handling authorization) the customer must accept before
   continuing — a habeas-data consent requirement of the payment gateway, each
   linking to its actual contract text.
3. **Summary**: product amount (unit price + IVA — tax rate is per product, since
   some products in Colombia have a reduced or zero IVA rate) + fixed base fee +
   delivery fee, shown in a backdrop component, with a payment button.
4. **Final status**: result of the transaction (approved / declined / error).
5. **Back to product page** with stock already updated.

## Payment confirmation flow

1. Create a transaction in `PENDING` state on the backend and obtain a transaction
   number.
2. Call the payment gateway to complete the charge (using the card token generated
   on the frontend).
3. Once the result is received (approved or declined):
   1. Update the transaction with the result.
   2. Assign the product to be delivered to the customer.
   3. Update the product's stock.
4. Show the final result and redirect to the product page with the updated stock.

## Backend functional requirements

- Entities: `stock`/`products`, `transactions`, `customers`, `deliveries`.
- No endpoint to create products — they are seeded as dummy data.
- Validations for real-world scenarios: invalid card, out-of-stock product,
  already-resolved transaction, network failure with the gateway, double submit, etc.
- Safe handling of sensitive data (see security section in ADR 0001): the PAN and CVC
  never reach the backend.

## Frontend functional requirements

- React SPA, mobile-first (minimum reference: iPhone SE 2020, 1334×750), responsive.
- Redux is mandatory (Flux), persisting checkout progress so a refresh doesn't lose
  the current step (resiliency requirement).
- Card brand detection (VISA/MasterCard) as a plus.

## Non-functional requirements

- Unit tests (Jest) on frontend and backend, >80% coverage.
- README including: data model design, public Postman collection or Swagger, coverage
  results, deployment link.
- Cloud deployment (AWS), with HTTPS and security headers (OWASP bonus).
- Hexagonal architecture with Ports & Adapters and Railway Oriented Programming in
  backend use cases (bonus).
- Frequent commits and PRs per feature — a repo with no visible progress voids the
  test.

## Out of scope

- Real payments (everything runs in sandbox).
- User authentication / customer accounts.
- Product admin panel.
- Kubernetes, Lambda, BFF (see ADR 0001 for the reasoning).

## Stretch goals (only if time remains after the required rubric items)

- Product listing/catalog page. The required flow only shows a single fixed product
  (see business flow above); a listing is not required and shouldn't be started
  before the core checkout flow, tests (>80% coverage) and deployment are done.

## Rubric (reference)

| Item | Points |
|---|---|
| Complete README | 5 |
| UI/images with no out-of-bounds issues | 5 |
| Complete checkout flow | 20 |
| API working correctly | 20 |
| Coverage >80% (front + back) | 30 |
| Cloud deployment | 20 |
| **Minimum to pass** | **100** |

Bonus: OWASP/HTTPS/security headers (5), fully responsive across browsers (5), CSS
(10), clean code (10), hexagonal + Ports & Adapters (10), ROP (10).
