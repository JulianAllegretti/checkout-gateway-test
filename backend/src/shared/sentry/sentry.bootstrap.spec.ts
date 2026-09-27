import * as Sentry from '@sentry/node';
import { initSentry, redactSensitiveData } from './sentry.bootstrap';

jest.mock('@sentry/node', () => ({ init: jest.fn() }));

describe('initSentry', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    (Sentry.init as jest.Mock).mockClear();
  });

  it('initializes Sentry with the DSN from env and the redaction beforeSend hook', () => {
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/1';

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://example.ingest.sentry.io/1', beforeSend: redactSensitiveData }),
    );
  });

  it('passes dsn: undefined when SENTRY_DSN is unset (Sentry no-ops safely)', () => {
    delete process.env.SENTRY_DSN;

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: undefined }));
  });
});

describe('redactSensitiveData', () => {
  it('redacts sensitive keys regardless of nesting depth', () => {
    const event = {
      message: 'Unexpected error',
      request: {
        data: {
          cardToken: 'tok_secret',
          customer: { email: 'jane@example.com', phone: '+571', firstName: 'Jane' },
        },
      },
      extra: { delivery: { address: 'Calle 123', city: 'Bogotá' } },
    };

    const redacted = redactSensitiveData(event) as typeof event;

    expect(redacted.request.data.cardToken).toBe('[Redacted]');
    expect(redacted.request.data.customer.email).toBe('[Redacted]');
    expect(redacted.request.data.customer.phone).toBe('[Redacted]');
    expect(redacted.request.data.customer.firstName).toBe('Jane');
    expect(redacted.extra.delivery.address).toBe('[Redacted]');
    expect(redacted.extra.delivery.city).toBe('Bogotá');
    expect(redacted.message).toBe('Unexpected error');
  });

  it('redacts sensitive keys inside arrays (e.g. breadcrumbs)', () => {
    const event = { breadcrumbs: [{ data: { email: 'jane@example.com' } }, { data: { note: 'ok' } }] };

    const redacted = redactSensitiveData(event) as typeof event;

    expect(redacted.breadcrumbs[0]?.data.email).toBe('[Redacted]');
    expect(redacted.breadcrumbs[1]?.data.note).toBe('ok');
  });

  it('passes through primitives and null untouched', () => {
    expect(redactSensitiveData('plain string')).toBe('plain string');
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(null)).toBeNull();
  });
});
