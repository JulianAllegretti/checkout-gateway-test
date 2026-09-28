import { HttpException, HttpStatus } from '@nestjs/common';
import type { GatewayError, TransactionNotFound } from '../../domain/errors';
import type { CreateTransactionError } from '../../ports/inbound/transactions.port';
import { ErrorResponseDto } from './dto/error-response.dto';

export type HttpMappableError = CreateTransactionError | TransactionNotFound | GatewayError;

/**
 * The one exhaustive switch from a domain error to the HTTP error envelope (see
 * API-CONTRACT.md). `REPOSITORY_ERROR` isn't a documented client-facing errorCode —
 * it's a technical failure, mapped to a generic 500 with no internal detail leaked.
 */
export function toHttpException(error: HttpMappableError): HttpException {
  const body = toErrorBody(error);
  return new HttpException(body, body.statusCode);
}

function toErrorBody(error: HttpMappableError): ErrorResponseDto {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return build(HttpStatus.BAD_REQUEST, error.type, error.message, error.details ?? null);
    case 'PRODUCT_NOT_FOUND':
    case 'TRANSACTION_NOT_FOUND':
      return build(HttpStatus.NOT_FOUND, error.type, error.message);
    case 'OUT_OF_STOCK':
    case 'INVALID_TRANSITION':
      return build(HttpStatus.CONFLICT, error.type, error.message);
    case 'REPOSITORY_ERROR':
      return build(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'An internal error occurred');
    case 'GATEWAY_ERROR':
      // Only reachable from PaymentController — CreateTransactionError no longer
      // includes GatewayError (see transactions.port.ts): a failed charge is a
      // resolved transaction, not an HTTP error. Here, nothing was created at
      // all, so a real error response is correct.
      return build(HttpStatus.BAD_GATEWAY, error.type, 'The payment gateway is currently unreachable');
  }
}

function build(statusCode: number, errorCode: string, message: string, details: unknown = null): ErrorResponseDto {
  return { statusCode, errorCode, message, details };
}
