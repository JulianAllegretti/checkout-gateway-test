import type { NewTransactionData } from '../../ports/outbound/transaction.repository';
import { PrismaService } from './prisma.service';
import { TransactionRepositoryPrisma } from './transaction.repository.prisma';

describe('TransactionRepositoryPrisma (integration)', () => {
  const prisma = new PrismaService();
  const repo = new TransactionRepositoryPrisma(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
  });

  async function createProduct(stock: number) {
    return prisma.product.create({
      data: { name: 'P', description: 'd', unitPriceAmount: 350000, taxRate: 0.19, stock },
    });
  }

  function buildData(productId: string, overrides: Partial<NewTransactionData> = {}): NewTransactionData {
    return {
      reference: overrides.reference ?? `TRX-${Math.random().toString(36).slice(2, 10)}`,
      idempotencyKey: overrides.idempotencyKey ?? `idem-${Math.random().toString(36).slice(2, 10)}`,
      productId,
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
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+573000000000' },
      delivery: { address: 'Calle 123', city: 'Bogotá' },
      ...overrides,
    };
  }

  describe('createPending', () => {
    it('creates the customer, delivery and a PENDING transaction, reserving stock', async () => {
      const product = await createProduct(5);

      const result = await repo.createPending(buildData(product.id, { quantity: 2 }));

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe('PENDING');
        expect(result.value.toProps().quantity).toBe(2);
      }

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(3);

      const transactionCount = await prisma.transaction.count();
      const customerCount = await prisma.customer.count();
      const deliveryCount = await prisma.delivery.count();
      expect(transactionCount).toBe(1);
      expect(customerCount).toBe(1);
      expect(deliveryCount).toBe(1);
    });

    it('errs with ProductNotFound for an unknown product', async () => {
      const result = await repo.createPending(buildData('00000000-0000-0000-0000-000000000000'));
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('errs with OutOfStock when quantity exceeds stock, without creating anything', async () => {
      const product = await createProduct(1);

      const result = await repo.createPending(buildData(product.id, { quantity: 2 }));

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('OUT_OF_STOCK');
      }

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(1);
      expect(await prisma.transaction.count()).toBe(0);
      expect(await prisma.customer.count()).toBe(0);
    });

    it('succeeds when quantity exactly matches the remaining stock', async () => {
      const product = await createProduct(3);
      const result = await repo.createPending(buildData(product.id, { quantity: 3 }));
      expect(result.isOk()).toBe(true);
      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(0);
    });

    it('only lets one of two concurrent buyers reserve the last unit', async () => {
      const product = await createProduct(1);

      const [first, second] = await Promise.all([
        repo.createPending(buildData(product.id, { quantity: 1 })),
        repo.createPending(buildData(product.id, { quantity: 1 })),
      ]);

      const outcomes = [first, second];
      const oks = outcomes.filter((r) => r.isOk());
      const errs = outcomes.filter((r) => r.isErr());
      expect(oks).toHaveLength(1);
      expect(errs).toHaveLength(1);
      if (errs[0]?.isErr()) {
        expect(errs[0].error.type).toBe('OUT_OF_STOCK');
      }

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(0);
      expect(await prisma.transaction.count()).toBe(1);
    });

    it('reuses the existing customer by email instead of duplicating it, refreshing stale contact details', async () => {
      const product = await createProduct(5);

      const first = await repo.createPending(
        buildData(product.id, {
          customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+571' },
        }),
      );
      const second = await repo.createPending(
        buildData(product.id, {
          customer: { firstName: 'Jane R.', lastName: 'Roe', email: 'jane@example.com', phone: '+572' },
        }),
      );

      expect(first.isOk()).toBe(true);
      expect(second.isOk()).toBe(true);
      expect(await prisma.customer.count()).toBe(1);

      if (first.isOk() && second.isOk()) {
        expect(second.value.toProps().customerId).toBe(first.value.toProps().customerId);
      }

      const customer = await prisma.customer.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
      expect(customer.firstName).toBe('Jane R.');
      expect(customer.lastName).toBe('Roe');
      expect(customer.phone).toBe('+572');
    });
  });

  describe('updateResult', () => {
    async function createPendingTransaction(stock = 5, quantity = 2) {
      const product = await createProduct(stock);
      const result = await repo.createPending(buildData(product.id, { quantity }));
      if (result.isErr()) throw new Error('setup failed');
      return { product, transaction: result.value };
    }

    it('APPROVED: does not restore stock, writes the payment row', async () => {
      const { product, transaction } = await createPendingTransaction(5, 2);

      const result = await repo.updateResult(transaction.id, {
        status: 'APPROVED',
        payment: { gatewayReference: 'gw-1', cardLast4: '4242', cardBrand: 'VISA' },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.status).toBe('APPROVED');

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(3); // still decremented, never restored

      const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId: transaction.id } });
      expect(payment.gatewayReference).toBe('gw-1');
      expect(payment.cardLast4).toBe('4242');
    });

    it('DECLINED: restores stock, writes the decline reason', async () => {
      const { product, transaction } = await createPendingTransaction(5, 2);

      await repo.updateResult(transaction.id, {
        status: 'DECLINED',
        payment: { declineReason: 'insufficient_funds', gatewayReference: 'gw-2' },
      });

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(5); // restored

      const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId: transaction.id } });
      expect(payment.declineReason).toBe('insufficient_funds');
    });

    it('ERROR: restores stock, writes the error reason', async () => {
      const { product, transaction } = await createPendingTransaction(5, 2);

      await repo.updateResult(transaction.id, {
        status: 'ERROR',
        payment: { errorReason: 'gateway timeout' },
      });

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(5);
    });

    it('is idempotent: a second call on an already-resolved transaction does not restore stock twice', async () => {
      const { product, transaction } = await createPendingTransaction(5, 2);

      await repo.updateResult(transaction.id, { status: 'APPROVED', payment: { gatewayReference: 'gw-1' } });
      // Simulates a racing webhook/poll trying to resolve the same transaction again.
      const second = await repo.updateResult(transaction.id, {
        status: 'DECLINED',
        payment: { declineReason: 'late webhook' },
      });

      expect(second.isOk()).toBe(true);
      if (second.isOk()) {
        // Status stays APPROVED — the second write never applied.
        expect(second.value.status).toBe('APPROVED');
      }

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.stock).toBe(3); // not restored by the late DECLINED attempt

      const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId: transaction.id } });
      expect(payment.gatewayReference).toBe('gw-1'); // not overwritten by the late attempt
    });
  });

  describe('findByIdempotencyKey', () => {
    it('returns null when nothing matches', async () => {
      const result = await repo.findByIdempotencyKey('nope');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toBeNull();
    });

    it('returns the transaction when the key matches', async () => {
      const product = await createProduct(5);
      const created = await repo.createPending(buildData(product.id, { idempotencyKey: 'idem-fixed' }));
      if (created.isErr()) throw new Error('setup failed');

      const result = await repo.findByIdempotencyKey('idem-fixed');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value?.id).toBe(created.value.id);
    });
  });

  describe('findById', () => {
    it('errs with TransactionNotFound for an unknown id', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe('TRANSACTION_NOT_FOUND');
    });
  });
});
