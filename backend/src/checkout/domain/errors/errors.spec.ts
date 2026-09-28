import {
  GatewayError,
  InvalidTransition,
  OutOfStock,
  PaymentDeclined,
  ProductNotFound,
  RepositoryError,
  TransactionAlreadyResolved,
  TransactionNotFound,
  ValidationError,
} from './index';

describe('domain errors', () => {
  it('ValidationError carries a message and optional details', () => {
    const error = new ValidationError('quantity must be >= 1', { field: 'quantity' });
    expect(error.type).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('quantity must be >= 1');
    expect(error.details).toEqual({ field: 'quantity' });
  });

  it('ProductNotFound', () => {
    const error = new ProductNotFound('product-1');
    expect(error.type).toBe('PRODUCT_NOT_FOUND');
    expect(error.productId).toBe('product-1');
    expect(error.message).toContain('product-1');
  });

  it('TransactionNotFound', () => {
    const error = new TransactionNotFound('txn-1');
    expect(error.type).toBe('TRANSACTION_NOT_FOUND');
    expect(error.transactionId).toBe('txn-1');
    expect(error.message).toContain('txn-1');
  });

  it('OutOfStock', () => {
    const error = new OutOfStock('product-1', 5);
    expect(error.type).toBe('OUT_OF_STOCK');
    expect(error.productId).toBe('product-1');
    expect(error.requestedQuantity).toBe(5);
    expect(error.message).toContain('product-1');
    expect(error.message).toContain('5');
  });

  it('TransactionAlreadyResolved', () => {
    const error = new TransactionAlreadyResolved('txn-1', 'APPROVED');
    expect(error.type).toBe('TRANSACTION_ALREADY_RESOLVED');
    expect(error.currentStatus).toBe('APPROVED');
    expect(error.message).toContain('APPROVED');
  });

  it('InvalidTransition', () => {
    const error = new InvalidTransition('APPROVED', 'PENDING');
    expect(error.type).toBe('INVALID_TRANSITION');
    expect(error.from).toBe('APPROVED');
    expect(error.to).toBe('PENDING');
    expect(error.message).toBe('Cannot transition transaction from APPROVED to PENDING');
  });

  it('PaymentDeclined', () => {
    const error = new PaymentDeclined('insufficient_funds', 'gw-ref-1', '4242', 'VISA');
    expect(error.type).toBe('PAYMENT_DECLINED');
    expect(error.reason).toBe('insufficient_funds');
    expect(error.gatewayReference).toBe('gw-ref-1');
    expect(error.cardLast4).toBe('4242');
    expect(error.cardBrand).toBe('VISA');
    expect(error.message).toContain('insufficient_funds');
  });

  it('PaymentDeclined without gateway/card details', () => {
    const error = new PaymentDeclined('insufficient_funds');
    expect(error.gatewayReference).toBeUndefined();
    expect(error.cardLast4).toBeUndefined();
  });

  it('GatewayError', () => {
    const error = new GatewayError('timeout');
    expect(error.type).toBe('GATEWAY_ERROR');
    expect(error.reason).toBe('timeout');
    expect(error.message).toContain('timeout');
  });

  it('RepositoryError', () => {
    const error = new RepositoryError('connection refused');
    expect(error.type).toBe('REPOSITORY_ERROR');
    expect(error.reason).toBe('connection refused');
    expect(error.message).toContain('connection refused');
  });
});
