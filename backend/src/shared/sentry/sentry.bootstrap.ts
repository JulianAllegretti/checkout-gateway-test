import * as Sentry from '@sentry/node';

// Same PII categories as pino.config.ts, but walked recursively — a Sentry event's
// shape (breadcrumbs, request context, stack frames) isn't as predictable as a
// single log call's payload, so exact dot-paths (pino's approach) don't fit here.
const SENSITIVE_KEYS = new Set([
  'cardToken',
  'paymentAcceptanceToken',
  'personalDataAuthToken',
  'email',
  'phone',
  'address',
]);
const REDACTED = '[Redacted]';

export function initSentry(): void {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || undefined,
    beforeSend: redactSensitiveData,
  });
}

export function redactSensitiveData<T>(event: T): T {
  return deepRedact(event) as T;
}

function deepRedact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepRedact);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.has(key) ? REDACTED : deepRedact(nested);
    }
    return result;
  }
  return value;
}
