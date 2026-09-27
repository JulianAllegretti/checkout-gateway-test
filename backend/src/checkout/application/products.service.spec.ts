import { errAsync, okAsync } from 'neverthrow';
import type { Product } from '../domain/entities';
import { ProductNotFound } from '../domain/errors';
import type { ProductRepository } from '../ports/outbound/product.repository';
import { ProductsService } from './products.service';

const product: Product = {
  id: 'prod-1',
  name: 'Wireless Headphones',
  description: 'Noise-cancelling',
  unitPriceAmount: 350000,
  taxRate: 0.19,
  stock: 5,
  imageUrl: null,
  isFeatured: true,
  currency: 'COP',
};

function fakeProductRepository(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findFeatured: () => okAsync(product),
    findById: (id: string) => okAsync({ ...product, id }),
    ...overrides,
  };
}

describe('ProductsService.getCurrent', () => {
  it('returns the featured product', async () => {
    const service = new ProductsService(fakeProductRepository());

    const result = await service.getCurrent();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(product);
  });

  it('propagates ProductNotFound when there is no featured product', async () => {
    const service = new ProductsService(
      fakeProductRepository({ findFeatured: () => errAsync(new ProductNotFound('featured')) }),
    );

    const result = await service.getCurrent();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('PRODUCT_NOT_FOUND');
  });
});
