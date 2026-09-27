import { HttpException, HttpStatus } from '@nestjs/common';
import type { CreateTransactionError } from '../../ports/inbound/transactions.port';
import type { TransactionNotFound } from '../../domain/errors';

export type HttpMappableError = CreateTransactionError | TransactionNotFound;

interface ErrorBody {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly message: string;
  readonly details: unknown;
}

/**
 * The one exhaustive switch from a domain error to the HTTP error envelope (see
 * API-CONTRACT.md). `REPOSITORY_ERROR` isn't a documented client-facing errorCode —
 * it's a technical failure, mapped to a generic 500 with no internal detail leaked.
 */
export function toHttpException(error: HttpMappableError): HttpException {
  const body = toErrorBody(error);
  return new HttpException(body, body.statusCode);
}

function toErrorBody(error: HttpMappableError): ErrorBody {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return build(HttpStatus.BAD_REQUEST, error.type, error.message, error.details ?? null);
    case 'PRODUCT_NOT_FOUND':
    case 'TRANSACTION_NOT_FOUND':
      return build(HttpStatus.NOT_FOUND, error.type, error.message);
    case 'OUT_OF_STOCK':
    case 'INVALID_TRANSITION':
      return build(HttpStatus.CONFLICT, error.type, error.message);
    case 'PAYMENT_DECLINED':
      return build(HttpStatus.UNPROCESSABLE_ENTITY, error.type, error.message);
    case 'GATEWAY_ERROR':
      // error.message wraps the raw axios/network failure (hostnames, timeouts,
      // upstream status text) — technical detail that never belongs in a client
      // response (API-CONTRACT.md: "never a raw exception/stack trace").
      return build(HttpStatus.BAD_GATEWAY, error.type, 'The payment gateway is currently unavailable');
    case 'REPOSITORY_ERROR':
      return build(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'An internal error occurred');
  }
}

function build(statusCode: number, errorCode: string, message: string, details: unknown = null): ErrorBody {
  return { statusCode, errorCode, message, details };
}
