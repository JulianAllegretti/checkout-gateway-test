import { HttpException, HttpStatus } from '@nestjs/common';
import { errAsync, okAsync } from 'neverthrow';
import { Transaction } from '../../domain/entities';
import type { TransactionDetail, TransactionStatus } from '../../domain/entities';
import { OutOfStock, RepositoryError, TransactionNotFound } from '../../domain/errors';
import type { TransactionsPort } from '../../ports/inbound/transactions.port';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionsController } from './transactions.controller';

function buildTransaction(status: TransactionStatus): Transaction {
  return new Transaction({
    id: 'trx-1',
    reference: 'idem-1',
    idempotencyKey: 'idem-1',
    productId: 'prod-1',
    customerId: 'cust-1',
    status,
    quantity: 2,
    unitPriceAmount: 100000,
    subtotalAmount: 200000,
    taxRate: 0.19,
    taxAmount: 38000,
    productAmount: 238000,
    baseFeeAmount: 5000,
    deliveryFeeAmount: 8000,
    totalAmount: 251000,
    currency: 'COP',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
}

function buildDetail(status: TransactionStatus, payment: TransactionDetail['payment'] = null): TransactionDetail {
  return {
    transaction: buildTransaction(status),
    customer: { id: 'cust-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' },
    delivery: { id: 'del-1', transactionId: 'trx-1', address: 'Calle 123', city: 'Bogotá', region: null, postalCode: null, notes: null },
    payment,
  };
}

function buildDto(): CreateTransactionDto {
  const dto = new CreateTransactionDto();
  dto.idempotencyKey = 'idem-1';
  dto.productId = 'prod-1';
  dto.quantity = 2;
  dto.cardToken = 'tok_test';
  dto.paymentAcceptanceToken = 'accept_token';
  dto.customer = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' };
  dto.delivery = { address: 'Calle 123', city: 'Bogotá' };
  return dto;
}

function fakePort(overrides: Partial<TransactionsPort> = {}): TransactionsPort {
  return {
    create: () => okAsync(buildTransaction('APPROVED')),
    getById: () => okAsync(buildDetail('APPROVED', { id: 'pay-1', transactionId: 'trx-1', cardBrand: 'VISA', cardLast4: '4242', gatewayReference: 'gw-1', declineReason: null, errorReason: null })),
    ...overrides,
  };
}

async function expectHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof HttpException) return e;
    throw e;
  }
  throw new Error('expected the call to throw an HttpException');
}

describe('TransactionsController.create', () => {
  it('creates, then fetches details, and returns the response without customer/delivery', async () => {
    const controller = new TransactionsController(fakePort());

    const result = await controller.create(buildDto());

    expect(result).toEqual({
      transactionId: 'trx-1',
      reference: 'idem-1',
      status: 'APPROVED',
      card: { brand: 'VISA', last4: '4242' },
      amount: {
        unitPrice: 100000,
        quantity: 2,
        subtotal: 200000,
        taxRate: 0.19,
        taxAmount: 38000,
        product: 238000,
        baseFee: 5000,
        deliveryFee: 8000,
        total: 251000,
        currency: 'COP',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect('customer' in result).toBe(false);
    expect('delivery' in result).toBe(false);
  });

  it('includes reason when the resolved transaction is DECLINED', async () => {
    const controller = new TransactionsController(
      fakePort({
        create: () => okAsync(buildTransaction('DECLINED')),
        getById: () =>
          okAsync(
            buildDetail('DECLINED', {
              id: 'pay-1',
              transactionId: 'trx-1',
              cardBrand: 'VISA',
              cardLast4: '4242',
              gatewayReference: 'gw-1',
              declineReason: 'insufficient_funds',
              errorReason: null,
            }),
          ),
      }),
    );

    const result = await controller.create(buildDto());

    expect(result.reason).toBe('insufficient_funds');
  });

  it('replaces a raw technical error reason with a generic message on ERROR (never leaks internals)', async () => {
    const controller = new TransactionsController(
      fakePort({
        create: () => okAsync(buildTransaction('ERROR')),
        getById: () =>
          okAsync(
            buildDetail('ERROR', {
              id: 'pay-1',
              transactionId: 'trx-1',
              cardBrand: null,
              cardLast4: null,
              gatewayReference: null,
              declineReason: null,
              errorReason: 'getaddrinfo ENOTFOUND internal-gateway-host.example',
            }),
          ),
      }),
    );

    const result = await controller.create(buildDto());

    expect(result.reason).toBe('A technical error occurred while processing the payment');
    expect(result.reason).not.toContain('ENOTFOUND');
  });

  it('omits reason for a DECLINED transaction with no declineReason on record', async () => {
    const controller = new TransactionsController(
      fakePort({
        create: () => okAsync(buildTransaction('DECLINED')),
        getById: () => okAsync(buildDetail('DECLINED', null)),
      }),
    );

    const result = await controller.create(buildDto());

    expect(result.reason).toBeUndefined();
  });

  it('throws the mapped HttpException when create() itself fails, without calling getById', async () => {
    const getById = jest.fn();
    const controller = new TransactionsController(
      fakePort({ create: () => errAsync(new OutOfStock('prod-1', 2)), getById }),
    );

    const exception = await expectHttpException(controller.create(buildDto()));

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect((exception.getResponse() as { errorCode: string }).errorCode).toBe('OUT_OF_STOCK');
    expect(getById).not.toHaveBeenCalled();
  });

  it('throws the mapped HttpException when the follow-up getById fails', async () => {
    const controller = new TransactionsController(
      fakePort({ getById: () => errAsync(new RepositoryError('connection lost')) }),
    );

    const exception = await expectHttpException(controller.create(buildDto()));

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe('TransactionsController.getById', () => {
  it('returns the full detail response including customer and delivery', async () => {
    const controller = new TransactionsController(fakePort());

    const result = await controller.getById('trx-1');

    expect(result.customer).toEqual({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' });
    expect(result.delivery).toEqual({ address: 'Calle 123', city: 'Bogotá', region: null, postalCode: null, notes: null });
  });

  it('returns card: null when there is no payment yet (still PENDING)', async () => {
    const controller = new TransactionsController(
      fakePort({ getById: () => okAsync(buildDetail('PENDING', null)) }),
    );

    const result = await controller.getById('trx-1');

    expect(result.card).toBeNull();
    expect(result.reason).toBeUndefined();
  });

  it('throws a 404 HttpException for TransactionNotFound', async () => {
    const controller = new TransactionsController(
      fakePort({ getById: () => errAsync(new TransactionNotFound('unknown-id')) }),
    );

    const exception = await expectHttpException(controller.getById('unknown-id'));

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });
});
