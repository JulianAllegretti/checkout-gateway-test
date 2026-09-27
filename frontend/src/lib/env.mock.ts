// Jest-only stand-in for env.ts (see jest.config.cjs's moduleNameMapper).
// Never imported directly by app code.
export const env = {
  paymentApiUrl: 'https://api-sandbox.example-gateway.dev/v1',
  paymentPublicKey: 'pub_test_mock',
  sentryDsn: '',
}
