import * as Sentry from '@sentry/react'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import { env } from './env'

// Customer contact/delivery info and any payment-related token — none of it
// is as sensitive as the PAN/CVC (which never reach our own state at all,
// see gatewayClient.ts), but none of it belongs in a third-party error
// tracker either.
const SENSITIVE_KEYS = new Set([
  'email',
  'phone',
  'address',
  'city',
  'region',
  'postalCode',
  'notes',
  'firstName',
  'lastName',
  'cardToken',
  'cardNumber',
  'cvc',
  'cvv',
  'paymentAcceptanceToken',
])

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[Redacted]' : redact(val),
      ]),
    )
  }
  return value
}

function beforeSend(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = redact(event.request) as typeof event.request
  }
  if (event.extra) {
    event.extra = redact(event.extra) as typeof event.extra
  }
  if (event.contexts) {
    event.contexts = redact(event.contexts) as typeof event.contexts
  }
  return event
}

function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.data) {
    breadcrumb.data = redact(breadcrumb.data) as typeof breadcrumb.data
  }
  return breadcrumb
}

// Called once at app bootstrap (main.tsx). Deliberately doesn't wire up
// @sentry/react's Redux enhancer — that would attach the whole checkoutSlice
// (customerDraft/deliveryDraft) to every event as state context, bypassing
// the redaction above entirely.
export function initSentry() {
  Sentry.init({
    dsn: env.sentryDsn || undefined,
    beforeSend,
    beforeBreadcrumb,
  })
}
