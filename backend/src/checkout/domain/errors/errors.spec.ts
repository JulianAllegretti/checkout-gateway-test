import {
  GatewayError,
  InvalidTransition,
  OutOfStock,
  PaymentDeclined,
  ProductNotFound,
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
    const error = new PaymentDeclined('insufficient_funds');
    expect(error.type).toBe('PAYMENT_DECLINED');
    expect(error.reason).toBe('insufficient_funds');
    expect(error.message).toContain('insufficient_funds');
  });

  it('GatewayError', () => {
    const error = new GatewayError('timeout');
    expect(error.type).toBe('GATEWAY_ERROR');
    expect(error.reason).toBe('timeout');
    expect(error.message).toContain('timeout');
  });
});
