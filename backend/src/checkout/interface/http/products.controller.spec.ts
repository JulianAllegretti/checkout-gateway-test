import { HttpException, HttpStatus } from '@nestjs/common';
import { errAsync, okAsync } from 'neverthrow';
import type { Product } from '../../domain/entities';
import { ProductNotFound } from '../../domain/errors';
import type { ProductsPort } from '../../ports/inbound/products.port';
import { ProductsController } from './products.controller';

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
  imageUrl: 'https://example.dev/img.jpg',
  isFeatured: true,
  currency: 'COP',
};

function fakePort(overrides: Partial<ProductsPort> = {}): ProductsPort {
  return { getCurrent: () => okAsync(product), ...overrides };
}

describe('ProductsController.getCurrent', () => {
  it('maps the product into the response shape, computing taxAmount/price/fees', async () => {
    const controller = new ProductsController(fakePort());

    const result = await controller.getCurrent();

    expect(result).toEqual({
      id: 'prod-1',
      name: 'Wireless Headphones',
      description: 'Noise-cancelling',
      unitPrice: 100000,
      taxRate: 0.19,
      taxAmount: 19000,
      price: 119000,
      stock: 5,
      imageUrl: 'https://example.dev/img.jpg',
      baseFee: 5000,
      deliveryFee: 8000,
      currency: 'COP',
    });
  });

  it('throws a 404 HttpException on ProductNotFound', async () => {
    const controller = new ProductsController(fakePort({ getCurrent: () => errAsync(new ProductNotFound('featured')) }));

    await expect(controller.getCurrent()).rejects.toThrow(HttpException);
    try {
      await controller.getCurrent();
      throw new Error('expected getCurrent() to throw');
    } catch (e) {
      if (e instanceof HttpException) {
        expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect((e.getResponse() as { errorCode: string }).errorCode).toBe('PRODUCT_NOT_FOUND');
      }
    }
  });
});
