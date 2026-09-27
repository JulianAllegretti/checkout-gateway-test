import { CustomerRepositoryPrisma } from './customer.repository.prisma';
import { PrismaService } from './prisma.service';

describe('CustomerRepositoryPrisma (integration)', () => {
  const prisma = new PrismaService();
  const repo = new CustomerRepositoryPrisma(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Full FK-safe cleanup, not just this file's own table: all these spec files
    // share one Postgres instance, so leftover rows from another file's last test
    // (run order isn't guaranteed) can still reference a customer.
    await prisma.payment.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
  });

  it('returns the customer', async () => {
    const customer = await prisma.customer.create({
      data: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+573000000000' },
    });

    const result = await repo.findById(customer.id);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.firstName).toBe('Jane');
      expect(result.value.lastName).toBe('Doe');
    }
  });

  it('errs with RepositoryError for an unknown id', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('REPOSITORY_ERROR');
    }
  });
});
