import { HttpStatus } from '@nestjs/common';
import {
  GatewayError,
  InvalidTransition,
  OutOfStock,
  PaymentDeclined,
  ProductNotFound,
  RepositoryError,
  TransactionNotFound,
  ValidationError,
} from '../../domain/errors';
import { toHttpException } from './http-error.mapper';

describe('toHttpException', () => {
  it('maps ValidationError to 400, passing through details', () => {
    const exception = toHttpException(new ValidationError('bad input', { field: 'quantity' }));
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'bad input',
      details: { field: 'quantity' },
    });
  });

  it('maps ValidationError with no details to details: null', () => {
    const exception = toHttpException(new ValidationError('bad input'));
    expect((exception.getResponse() as { details: unknown }).details).toBeNull();
  });

  it('maps ProductNotFound to 404', () => {
    const exception = toHttpException(new ProductNotFound('prod-1'));
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('PRODUCT_NOT_FOUND');
  });

  it('maps TransactionNotFound to 404', () => {
    const exception = toHttpException(new TransactionNotFound('trx-1'));
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('TRANSACTION_NOT_FOUND');
  });

  it('maps OutOfStock to 409', () => {
    const exception = toHttpException(new OutOfStock('prod-1', 5));
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('OUT_OF_STOCK');
  });

  it('maps InvalidTransition to 409', () => {
    const exception = toHttpException(new InvalidTransition('APPROVED', 'DECLINED'));
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('INVALID_TRANSITION');
  });

  it('maps PaymentDeclined to 422', () => {
    const exception = toHttpException(new PaymentDeclined('insufficient_funds'));
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('PAYMENT_DECLINED');
  });

  it('maps GatewayError to 502 with a generic message, without leaking the raw technical reason', () => {
    const exception = toHttpException(new GatewayError('getaddrinfo ENOTFOUND internal-gateway-host.example'));
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    const body = exception.getResponse() as { errorCode: string; message: string };
    expect(body.errorCode).toBe('GATEWAY_ERROR');
    expect(body.message).not.toContain('ENOTFOUND');
  });

  it('maps RepositoryError to a generic 500, without leaking the internal reason', () => {
    const exception = toHttpException(new RepositoryError('connection string leaked here'));
    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = exception.getResponse() as { errorCode: string; message: string };
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.message).not.toContain('connection string');
  });
});
