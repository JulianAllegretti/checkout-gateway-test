import { Transaction, type TransactionProps, type TransactionStatus } from './index';

function buildTransaction(status: TransactionStatus): Transaction {
  const props: TransactionProps = {
    id: 'txn-1',
    reference: 'TRX-000001',
    idempotencyKey: 'idem-1',
    productId: 'product-1',
    customerId: 'customer-1',
    status,
    quantity: 1,
    unitPriceAmount: 350000,
    subtotalAmount: 350000,
    taxRate: 0.19,
    taxAmount: 66500,
    productAmount: 416500,
    baseFeeAmount: 5000,
    deliveryFeeAmount: 8000,
    totalAmount: 429500,
    currency: 'COP',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  return new Transaction(props);
}

describe('Transaction.transitionTo', () => {
  it.each([['APPROVED'], ['DECLINED'], ['ERROR'], ['VOIDED']] as [TransactionStatus][])(
    'allows PENDING -> %s',
    (next) => {
      const result = buildTransaction('PENDING').transitionTo(next);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe(next);
      }
    },
  );

  it.each([['PENDING'], ['APPROVED'], ['DECLINED'], ['ERROR'], ['VOIDED']] as [TransactionStatus][])(
    'rejects APPROVED -> %s (final states never transition)',
    (next) => {
      const result = buildTransaction('APPROVED').transitionTo(next);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('INVALID_TRANSITION');
        expect(result.error.from).toBe('APPROVED');
        expect(result.error.to).toBe(next);
      }
    },
  );

  it('rejects DECLINED -> APPROVED', () => {
    const result = buildTransaction('DECLINED').transitionTo('APPROVED');
    expect(result.isErr()).toBe(true);
  });

  it('rejects PENDING -> PENDING (no-op transition is still invalid)', () => {
    const result = buildTransaction('PENDING').transitionTo('PENDING');
    expect(result.isErr()).toBe(true);
  });

  it('returns a new Transaction instance instead of mutating', () => {
    const original = buildTransaction('PENDING');
    const result = original.transitionTo('APPROVED');
    expect(original.status).toBe('PENDING');
    expect(result.isOk() && result.value).not.toBe(original);
  });
});

describe('Transaction accessors', () => {
  it('exposes id and the underlying props', () => {
    const transaction = buildTransaction('PENDING');
    expect(transaction.id).toBe('txn-1');
    expect(transaction.toProps().reference).toBe('TRX-000001');
  });
});

describe('Transaction.isResolved', () => {
  it('is false while PENDING', () => {
    expect(buildTransaction('PENDING').isResolved()).toBe(false);
  });

  it.each([['APPROVED'], ['DECLINED'], ['ERROR'], ['VOIDED']] as [TransactionStatus][])(
    'is true once %s',
    (status) => {
      expect(buildTransaction(status).isResolved()).toBe(true);
    },
  );
});
