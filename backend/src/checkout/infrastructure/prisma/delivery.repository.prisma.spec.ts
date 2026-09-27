import { DeliveryRepositoryPrisma } from './delivery.repository.prisma';
import { PrismaService } from './prisma.service';

describe('DeliveryRepositoryPrisma (integration)', () => {
  const prisma = new PrismaService();
  const repo = new DeliveryRepositoryPrisma(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Full FK-safe cleanup: these spec files share one Postgres instance.
    await prisma.payment.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
  });

  async function createTransaction() {
    const product = await prisma.product.create({
      data: { name: 'P', description: 'd', unitPriceAmount: 1000, taxRate: 0, stock: 5 },
    });
    const customer = await prisma.customer.create({
      data: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+573000000000' },
    });
    return prisma.transaction.create({
      data: {
        reference: 'TRX-000001',
        idempotencyKey: 'idem-1',
        productId: product.id,
        customerId: customer.id,
        quantity: 1,
        unitPriceAmount: 1000,
        subtotalAmount: 1000,
        taxRate: 0,
        taxAmount: 0,
        productAmount: 1000,
        baseFeeAmount: 0,
        deliveryFeeAmount: 0,
        totalAmount: 1000,
      },
    });
  }

  it('returns the delivery for a transaction', async () => {
    const transaction = await createTransaction();
    await prisma.delivery.create({
      data: { transactionId: transaction.id, address: 'Calle 123', city: 'Bogotá' },
    });

    const result = await repo.findByTransactionId(transaction.id);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.address).toBe('Calle 123');
      expect(result.value.city).toBe('Bogotá');
    }
  });

  it('errs with RepositoryError when there is no delivery for that transaction', async () => {
    const transaction = await createTransaction();
    const result = await repo.findByTransactionId(transaction.id);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('REPOSITORY_ERROR');
    }
  });
});
