# API Contract

Shared source of truth between frontend and backend. All endpoints are served under
`/api`. This is a hand-written draft; once the backend exists it will be complemented
by a generated OpenAPI/Swagger doc (see ADR 0001), but this file stays the readable
reference.

## Design notes

- A single fixed product is shown to the customer (see [PRD.md](PRD.md)). There is no
  product-selection endpoint; `GET /products/current` always resolves to that product.
- `POST /transactions` is one orchestrating endpoint that creates the customer, the
  delivery and the transaction atomically, then calls the payment gateway. It still
  exercises `stock`, `transactions`, `customers` and `deliveries` as distinct
  persistence operations internally (see ADR 0001), it's just exposed as a single HTTP
  call so the checkout stays atomic and easy to reason about for double-submit safety.
- The card PAN and CVC **never** reach the backend. The frontend tokenizes the card
  directly with the gateway's public key and only sends the resulting `cardToken`.
- The gateway's merchant-info endpoint (source of the two consent tokens below) has
  no browser CORS support, unlike tokenization — `GET /payment/acceptance-tokens` is
  our own endpoint, fetching them server-side on the frontend's behalf.
- The backend never trusts client-sent amounts: `unitPrice`, `subtotal`, `taxRate`,
  `taxAmount`, `product`, `baseFee` and `deliveryFee` in the response are always
  recomputed server-side from the DB / config, never echoed back from the request.
  `quantity` is the one client-sent number that matters, and it's what gets reserved
  from stock atomically (see ADR 0001) — everything money-related is derived from it
  server-side.
- All money amounts are integers in the currency's minor-less base unit (COP has no
  decimals), field `currency` is always `"COP"`.

## Error envelope

```json
{
  "statusCode": 409,
  "errorCode": "OUT_OF_STOCK",
  "message": "Product is out of stock",
  "details": null
}
```

| `errorCode` | HTTP status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed/invalid request body (bad card token format, missing fields, invalid email, etc.) — `details` carries a `{ field: [messages] }` map |
| `PRODUCT_NOT_FOUND` | 404 | `productId` doesn't match the current product |
| `TRANSACTION_NOT_FOUND` | 404 | `GET /transactions/:id` with an unknown id |
| `OUT_OF_STOCK` | 409 | Stock reservation failed at transaction creation (see ADR 0001) |
| `INVALID_TRANSITION` | 409 | Internal state machine guard tripped (shouldn't reach the client in practice) |
| `INTERNAL_ERROR` | 500 | Unexpected failure (e.g. a DB error) not covered by any of the above. `message` is always generic |
| `GATEWAY_ERROR` | 502 | `GET /payment/acceptance-tokens` couldn't reach the gateway. Not returned by `POST /transactions` — a gateway failure there resolves the transaction as `status: "ERROR"` instead, see below |

A declined charge or a technical failure to charge the card is **not** one of these
error codes — `POST /transactions` still responds `201` in both cases, with
`status: "DECLINED"` or `status: "ERROR"` and a `reason`. See below.

Retrying the same `idempotencyKey` (double click, network retry) is **not** an
error case — see `POST /transactions`'s Idempotency note below. It returns `201`
with the transaction's current state, whatever that is (`PENDING` if the original
attempt is still in flight, or its final resolved status otherwise).

## `GET /health`

Liveness/readiness probe, outside `/api` and unauthenticated. Used by the Docker
Compose `healthcheck` directive on EC2 and by the deploy script to confirm the
container is actually serving before considering a deploy successful (see ADR 0001).

**Response `200`**
```json
{
  "status": "ok",
  "database": "ok"
}
```

**Response `503`**: same shape with `"database": "error"` when the DB connection
check fails.

## `GET /products/current`

Returns the product shown on screen 1, plus the fixed fees used to compute the
summary on screen 3.

**Response `200`**
```json
{
  "id": "b3f1c2a0-...-uuid",
  "name": "Wireless Headphones",
  "description": "Over-ear, active noise cancellation.",
  "unitPrice": 350000,
  "taxRate": 0.19,
  "taxAmount": 66500,
  "price": 416500,
  "stock": 12,
  "imageUrl": "https://.../headphones.jpg",
  "baseFee": 5000,
  "deliveryFee": 8000,
  "currency": "COP"
}
```

`price` is the final, tax-included price (`unitPrice + taxAmount`) — what's shown as
"product amount" on the summary screen. `taxRate` varies per product (some categories
in Colombia have a reduced or zero IVA rate), so it's never assumed to be a fixed
19% on the frontend.

## `GET /payment/acceptance-tokens`

The pair of habeas-data consent tokens the gateway requires on every charge —
fetched once when the payment screen mounts, and shown to the customer as two
required checkboxes (one per contract) before they can submit. See PRD.md.

**Response `200`**
```json
{
  "termsToken": "eyJhbGciOi...",
  "termsUrl": "https://.../terms.pdf",
  "personalDataToken": "eyJhbGciOi...",
  "personalDataUrl": "https://.../personal-data.pdf"
}
```

`termsToken`/`personalDataToken` are sent back as `paymentAcceptanceToken` /
`personalDataAuthToken` on `POST /transactions`. The `*Url` fields are the actual
contract text, for the checkbox labels to link to.

## `POST /transactions`

Creates the customer + delivery + a `PENDING` transaction (reserving stock
atomically), then charges the card via the gateway. Every charge is created
`PENDING` on the gateway's side and never resolves synchronously — the backend
polls the gateway's own status endpoint internally (server-side, up to 10 times,
5 seconds apart) until it settles, before responding. In the worst case (the
gateway never resolves) this endpoint can take roughly a minute to respond; the
client's own polling of `GET /transactions/:id` remains in place as a resiliency
fallback (e.g. a server restart mid-charge), not as the primary mechanism.

**Request**
```json
{
  "idempotencyKey": "6c1f... (client-generated UUID, same value on retry)",
  "productId": "b3f1c2a0-...-uuid",
  "quantity": 2,
  "cardToken": "tok_...",
  "paymentAcceptanceToken": "eyJhbGciOi...",
  "personalDataAuthToken": "eyJhbGciOi...",
  "customer": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+573001234567"
  },
  "delivery": {
    "address": "Calle 123 #45-67",
    "city": "Bogotá",
    "region": "Cundinamarca",
    "postalCode": "110111",
    "notes": "Apt 4B"
  }
}
```

**Response `201`**
```json
{
  "transactionId": "8a2e...-uuid",
  "reference": "TRX-000123",
  "status": "APPROVED",
  "card": {
    "brand": "VISA",
    "last4": "4242"
  },
  "amount": {
    "unitPrice": 350000,
    "quantity": 2,
    "subtotal": 700000,
    "taxRate": 0.19,
    "taxAmount": 133000,
    "product": 833000,
    "baseFee": 5000,
    "deliveryFee": 8000,
    "total": 846000,
    "currency": "COP"
  },
  "createdAt": "2026-09-25T14:03:00.000Z"
}
```

`status` is one of `PENDING | APPROVED | DECLINED | ERROR` (`PENDING` only appears
here in the unlikely event of a server crash mid-charge — normally this endpoint
doesn't respond until the gateway's own internal polling settles, see above). When
`status` is
`DECLINED` or `ERROR`, the response also includes a `reason` string (the gateway's
decline reason, or a generic message for technical errors — never a raw
exception/stack trace). A declined or failed charge is a normal `201`, not an error
response — the transaction was still created and resolved, just with an unhappy
outcome. The only error responses this endpoint can return are the ones in the
[error envelope](#error-envelope) table above (validation, out-of-stock, ...), which
mean no transaction was created at all.

**Idempotency**: retrying the same `idempotencyKey` (double click, network retry)
returns the existing transaction instead of creating a new one / re-reserving stock.

## `GET /transactions/:id`

Used for polling while `status = PENDING`, and to recover the current step / final
result after a page refresh (resiliency requirement).

**Response `200`**: same shape as the `POST /transactions` response, plus `delivery`
and `customer` summaries needed to render the final status screen.
