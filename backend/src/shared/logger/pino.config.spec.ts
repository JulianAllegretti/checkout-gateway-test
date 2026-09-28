import pino from 'pino';
import { Writable } from 'stream';
import type { IncomingMessage } from 'http';
import { pinoConfig, REDACT_PATHS } from './pino.config';

function captureLog(): { logger: pino.Logger; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[Redacted]' } }, stream);
  return { logger, lines: () => chunks.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe('pino redaction config', () => {
  it('redacts cardToken, paymentAcceptanceToken, customer email/phone and delivery address under `cmd`', () => {
    const { logger, lines } = captureLog();

    logger.info(
      {
        cmd: {
          cardToken: 'tok_super_secret',
          paymentAcceptanceToken: 'accept_secret',
          customer: { firstName: 'Jane', email: 'jane@example.com', phone: '+573000000000' },
          delivery: { city: 'Bogotá', address: 'Calle 123 #45-67' },
        },
      },
      'Received create-transaction request',
    );

    const [line] = lines();
    const cmd = line?.cmd as Record<string, unknown>;
    expect(cmd.cardToken).toBe('[Redacted]');
    expect(cmd.paymentAcceptanceToken).toBe('[Redacted]');
    expect((cmd.customer as Record<string, unknown>).email).toBe('[Redacted]');
    expect((cmd.customer as Record<string, unknown>).phone).toBe('[Redacted]');
    expect((cmd.delivery as Record<string, unknown>).address).toBe('[Redacted]');
  });

  it('leaves non-sensitive fields untouched', () => {
    const { logger, lines } = captureLog();

    logger.info({ cmd: { customer: { firstName: 'Jane' }, delivery: { city: 'Bogotá' } } }, 'msg');

    const [line] = lines();
    const cmd = line?.cmd as Record<string, unknown>;
    expect((cmd.customer as Record<string, unknown>).firstName).toBe('Jane');
    expect((cmd.delivery as Record<string, unknown>).city).toBe('Bogotá');
  });

  it('redacts the Authorization header when present', () => {
    const { logger, lines } = captureLog();

    logger.info({ req: { headers: { authorization: 'Bearer prv_secret' } } }, 'msg');

    const [line] = lines();
    const req = line?.req as Record<string, unknown>;
    expect((req.headers as Record<string, unknown>).authorization).toBe('[Redacted]');
  });

  const genReqId = (pinoConfig.pinoHttp as { genReqId: (req: IncomingMessage) => string }).genReqId;

  it('genReqId reuses an inbound X-Request-Id header when present', () => {
    const req = { headers: { 'x-request-id': 'req-from-load-balancer' } } as unknown as IncomingMessage;

    expect(genReqId(req)).toBe('req-from-load-balancer');
  });

  it('genReqId mints a UUID when no X-Request-Id header is present', () => {
    const req = { headers: {} } as unknown as IncomingMessage;

    expect(genReqId(req)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('covers exactly the fields ADR 0001 calls out (token, email, address) plus phone', () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'cmd.cardToken',
        'cmd.paymentAcceptanceToken',
        'cmd.customer.email',
        'cmd.customer.phone',
        'cmd.delivery.address',
      ]),
    );
  });
});
