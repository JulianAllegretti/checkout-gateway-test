import { errAsync, okAsync } from 'neverthrow';
import type { Product, TransactionDetail } from '../domain/entities';
import { Transaction } from '../domain/entities';
import {
  GatewayError,
  OutOfStock,
  PaymentDeclined,
  ProductNotFound,
  RepositoryError,
  TransactionNotFound,
} from '../domain/errors';
import type { CreateTransactionCommand } from '../ports/inbound/transactions.port';
import type { PaymentGatewayPort } from '../ports/outbound/payment-gateway.port';
import type { ProductRepository } from '../ports/outbound/product.repository';
import type { NewTransactionData, TransactionRepository } from '../ports/outbound/transaction.repository';
import { TransactionsService } from './transactions.service';

const env = { ...process.env };

beforeEach(() => {
  process.env.BASE_FEE_AMOUNT = '5000';
  process.env.DELIVERY_FEE_AMOUNT = '8000';
});

afterEach(() => {
  process.env = { ...env };
});

const product: Product = {
  id: 'prod-1',
  name: 'Wireless Headphones',
  description: 'Noise-cancelling',
  unitPriceAmount: 100000,
  taxRate: 0.19,
  stock: 5,
  imageUrl: null,
  isFeatured: true,
  currency: 'COP',
};

function buildCommand(overrides: Partial<CreateTransactionCommand> = {}): CreateTransactionCommand {
  return {
    idempotencyKey: 'idem-1',
    productId: product.id,
    quantity: 2,
    cardToken: 'tok_card',
    paymentAcceptanceToken: 'accept_token',
    customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' },
    delivery: { address: 'Calle 123', city: 'Bogotá' },
    ...overrides,
  };
}

function pendingTransaction(): Transaction {
  return new Transaction({
    id: 'trx-1',
    reference: 'idem-1',
    idempotencyKey: 'idem-1',
    productId: product.id,
    customerId: 'cust-1',
    status: 'PENDING',
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

function fakeProductRepository(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findFeatured: () => okAsync(product),
    findById: () => okAsync(product),
    ...overrides,
  };
}

function fakeTransactionRepository(overrides: Partial<TransactionRepository> = {}): TransactionRepository {
  return {
    findByIdempotencyKey: () => okAsync(null),
    createPending: () => okAsync(pendingTransaction()),
    updateResult: (_id, resolution) =>
      okAsync(
        new Transaction({
          ...pendingTransaction().toProps(),
          status: resolution.status,
        }),
      ),
    findById: () => errAsync(new TransactionNotFound('trx-1')),
    findByIdWithDetails: () => errAsync(new TransactionNotFound('trx-1')),
    ...overrides,
  };
}

function fakePaymentGateway(overrides: Partial<PaymentGatewayPort> = {}): PaymentGatewayPort {
  return {
    charge: () => okAsync({ gatewayReference: 'gw-1', cardLast4: '4242', cardBrand: 'VISA' }),
    ...overrides,
  };
}

function buildService(deps: {
  products?: ProductRepository;
  transactions?: TransactionRepository;
  gateway?: PaymentGatewayPort;
}): TransactionsService {
  return new TransactionsService(
    deps.products ?? fakeProductRepository(),
    deps.transactions ?? fakeTransactionRepository(),
    deps.gateway ?? fakePaymentGateway(),
  );
}

describe('TransactionsService.create', () => {
  it('rejects a non-positive or non-integer quantity without touching any repository', async () => {
    const findByIdempotencyKey = jest.fn(() => okAsync(null));
    const service = buildService({ transactions: fakeTransactionRepository({ findByIdempotencyKey }) });

    for (const quantity of [0, -1, 1.5]) {
      const result = await service.create(buildCommand({ quantity }));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe('VALIDATION_ERROR');
    }
    expect(findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('short-circuits on a retried idempotency key, without creating or charging again', async () => {
    const existing = pendingTransaction();
    const createPending = jest.fn();
    const charge = jest.fn();
    const service = buildService({
      transactions: fakeTransactionRepository({ findByIdempotencyKey: () => okAsync(existing), createPending }),
      gateway: fakePaymentGateway({ charge }),
    });

    const result = await service.create(buildCommand());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(existing);
    expect(createPending).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('errs with ProductNotFound and never reaches createPending/charge', async () => {
    const createPending = jest.fn();
    const service = buildService({
      products: fakeProductRepository({ findById: () => errAsync(new ProductNotFound(product.id)) }),
      transactions: fakeTransactionRepository({ createPending }),
    });

    const result = await service.create(buildCommand());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('PRODUCT_NOT_FOUND');
    expect(createPending).not.toHaveBeenCalled();
  });

  it('computes pricing (subtotal, tax, total) from the product and quantity, and never calls the gateway on OutOfStock', async () => {
    const createPending = jest.fn((data: NewTransactionData) => errAsync(new OutOfStock(product.id, data.quantity)));
    const charge = jest.fn();
    const service = buildService({
      transactions: fakeTransactionRepository({ createPending }),
      gateway: fakePaymentGateway({ charge }),
    });

    const result = await service.create(buildCommand({ quantity: 2 }));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('OUT_OF_STOCK');
    expect(charge).not.toHaveBeenCalled();

    const data = createPending.mock.calls[0]?.[0] as NewTransactionData;
    expect(data.unitPriceAmount).toBe(100000);
    expect(data.subtotalAmount).toBe(200000); // 100000 * 2
    expect(data.taxAmount).toBe(38000); // 200000 * 0.19
    expect(data.productAmount).toBe(238000);
    expect(data.baseFeeAmount).toBe(5000);
    expect(data.deliveryFeeAmount).toBe(8000);
    expect(data.totalAmount).toBe(251000);
    expect(data.reference).toBe('idem-1');
  });

  it('resolves to APPROVED and returns Ok on a successful charge', async () => {
    const updateResult = jest.fn((_id: string, resolution: Parameters<TransactionRepository['updateResult']>[1]) =>
      okAsync(new Transaction({ ...pendingTransaction().toProps(), status: resolution.status })),
    );
    const service = buildService({ transactions: fakeTransactionRepository({ updateResult }) });

    const result = await service.create(buildCommand());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.status).toBe('APPROVED');
    expect(updateResult).toHaveBeenCalledWith(
      'trx-1',
      expect.objectContaining({
        status: 'APPROVED',
        payment: { gatewayReference: 'gw-1', cardLast4: '4242', cardBrand: 'VISA' },
      }),
    );
  });

  it('on a declined charge: persists and returns DECLINED with the decline reason (not a create() error)', async () => {
    const updateResult = jest.fn((_id: string, resolution: Parameters<TransactionRepository['updateResult']>[1]) =>
      okAsync(new Transaction({ ...pendingTransaction().toProps(), status: resolution.status })),
    );
    const service = buildService({
      transactions: fakeTransactionRepository({ updateResult }),
      gateway: fakePaymentGateway({
        charge: () => errAsync(new PaymentDeclined('insufficient_funds', 'gw-2', '1111', 'MASTERCARD')),
      }),
    });

    const result = await service.create(buildCommand());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.status).toBe('DECLINED');
    expect(updateResult).toHaveBeenCalledWith(
      'trx-1',
      expect.objectContaining({
        status: 'DECLINED',
        payment: { gatewayReference: 'gw-2', cardLast4: '1111', cardBrand: 'MASTERCARD', declineReason: 'insufficient_funds' },
      }),
    );
  });

  it('on a gateway error: persists and returns ERROR with the error reason (not a create() error)', async () => {
    const updateResult = jest.fn((_id: string, resolution: Parameters<TransactionRepository['updateResult']>[1]) =>
      okAsync(new Transaction({ ...pendingTransaction().toProps(), status: resolution.status })),
    );
    const service = buildService({
      transactions: fakeTransactionRepository({ updateResult }),
      gateway: fakePaymentGateway({ charge: () => errAsync(new GatewayError('timeout')) }),
    });

    const result = await service.create(buildCommand());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.status).toBe('ERROR');
    expect(updateResult).toHaveBeenCalledWith(
      'trx-1',
      expect.objectContaining({ status: 'ERROR', payment: { errorReason: 'timeout' } }),
    );
  });

  it('surfaces a RepositoryError when persisting a declined/error resolution itself fails', async () => {
    const service = buildService({
      transactions: fakeTransactionRepository({
        updateResult: () => errAsync(new RepositoryError('connection lost')),
      }),
      gateway: fakePaymentGateway({ charge: () => errAsync(new PaymentDeclined('insufficient_funds')) }),
    });

    const result = await service.create(buildCommand());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('REPOSITORY_ERROR');
  });
});

describe('TransactionsService.getById', () => {
  it('delegates to transactionRepository.findByIdWithDetails', async () => {
    const detail: TransactionDetail = {
      transaction: pendingTransaction(),
      customer: { id: 'cust-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' },
      delivery: { id: 'del-1', transactionId: 'trx-1', address: 'Calle 123', city: 'Bogotá', region: null, postalCode: null, notes: null },
      payment: null,
    };
    const service = buildService({
      transactions: fakeTransactionRepository({ findByIdWithDetails: () => okAsync(detail) }),
    });

    const result = await service.getById('trx-1');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(detail);
  });

  it('propagates TransactionNotFound', async () => {
    const service = buildService({});

    const result = await service.getById('unknown-id');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('TRANSACTION_NOT_FOUND');
  });
});
