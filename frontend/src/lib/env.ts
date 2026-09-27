// Centralizes Vite env var reads. gatewayClient.ts and (later) sentry.ts
// import `env` from here instead of touching `import.meta.env` directly —
// that syntax can't be parsed under the CommonJS module target our Jest
// tests use. jest.config.cjs's moduleNameMapper swaps this file for
// env.mock.ts in tests, so this one is never actually loaded there.
export const env = {
  paymentApiUrl: import.meta.env.VITE_PAYMENT_API_URL,
  paymentPublicKey: import.meta.env.VITE_PAYMENT_PUBLIC_KEY,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
}
