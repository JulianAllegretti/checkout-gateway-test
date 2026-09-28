import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Params } from 'nestjs-pino';

/**
 * Fields that must never reach a log line verbatim (ADR 0001: "Pino redacts
 * token, email and address"; phone is the same category of PII, added for the
 * same reason). `cmd.*` matches the one place these fields are deliberately
 * logged — TransactionsController's debug log of the incoming command.
 */
export const REDACT_PATHS = [
  'cmd.cardToken',
  'cmd.paymentAcceptanceToken',
  'cmd.personalDataAuthToken',
  'cmd.customer.email',
  'cmd.customer.phone',
  'cmd.delivery.address',
  'req.headers.authorization',
];

export const pinoConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    // Correlates a request across services/logs: reuse an inbound X-Request-Id
    // (e.g. from CloudFront/ALB) when present, otherwise mint one.
    genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
  },
};
