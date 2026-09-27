import { Controller, Get, Inject } from '@nestjs/common';
import type { Product } from '../../domain/entities';
import { PRODUCTS_PORT, type ProductsPort } from '../../ports/inbound/products.port';
import { Money } from '../../domain/value-objects/money';
import { toHttpException } from './http-error.mapper';

interface ProductResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unitPrice: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly price: number;
  readonly stock: number;
  readonly imageUrl: string | null;
  readonly baseFee: number;
  readonly deliveryFee: number;
  readonly currency: string;
}

function toProductResponse(product: Product): ProductResponse {
  const unitPrice = Money.of(product.unitPriceAmount, product.currency);
  const taxAmount = unitPrice.multiply(product.taxRate);
  const price = unitPrice.add(taxAmount);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    unitPrice: unitPrice.amount,
    taxRate: product.taxRate,
    taxAmount: taxAmount.amount,
    price: price.amount,
    stock: product.stock,
    imageUrl: product.imageUrl,
    baseFee: Number(process.env.BASE_FEE_AMOUNT),
    deliveryFee: Number(process.env.DELIVERY_FEE_AMOUNT),
    currency: product.currency,
  };
}

@Controller('products')
export class ProductsController {
  constructor(@Inject(PRODUCTS_PORT) private readonly productsPort: ProductsPort) {}

  @Get('current')
  async getCurrent(): Promise<ProductResponse> {
    const result = await this.productsPort.getCurrent();
    if (result.isErr()) throw toHttpException(result.error);
    return toProductResponse(result.value);
  }
}
