import { ProductRepositoryPrisma } from './product.repository.prisma';
import { PrismaService } from './prisma.service';

describe('ProductRepositoryPrisma (integration)', () => {
  const prisma = new PrismaService();
  const repo = new ProductRepositoryPrisma(prisma);

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

  describe('findFeatured', () => {
    it('returns the product marked as featured', async () => {
      await prisma.product.create({
        data: {
          name: 'Not featured',
          description: 'd',
          unitPriceAmount: 1000,
          taxRate: 0.19,
          stock: 5,
          isFeatured: false,
        },
      });
      const featured = await prisma.product.create({
        data: {
          name: 'Featured',
          description: 'd',
          unitPriceAmount: 2000,
          taxRate: 0.19,
          stock: 10,
          isFeatured: true,
        },
      });

      const result = await repo.findFeatured();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe(featured.id);
        expect(result.value.name).toBe('Featured');
        expect(result.value.taxRate).toBe(0.19);
      }
    });

    it('errs with ProductNotFound when nothing is featured', async () => {
      const result = await repo.findFeatured();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });

  describe('findById', () => {
    it('returns the product', async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Keyboard',
          description: 'd',
          unitPriceAmount: 420000,
          taxRate: 0,
          stock: 8,
        },
      });

      const result = await repo.findById(product.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Keyboard');
        expect(result.value.taxRate).toBe(0);
      }
    });

    it('errs with ProductNotFound for an unknown id', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });
});
