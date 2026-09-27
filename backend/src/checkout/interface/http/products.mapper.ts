import type { Product } from '../../domain/entities';
import { Money } from '../../domain/value-objects/money';

export interface ProductResponse {
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

export function toProductResponse(product: Product): ProductResponse {
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
