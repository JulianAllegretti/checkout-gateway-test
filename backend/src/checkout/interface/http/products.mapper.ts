import { ApiProperty } from '@nestjs/swagger';
import type { Product } from '../../domain/entities';
import { Money } from '../../domain/value-objects/money';

// A class, not an interface: @nestjs/swagger reads response shapes via
// reflection, and interfaces are erased at compile time — there'd be nothing
// left for it to introspect.
export class ProductResponse {
  @ApiProperty({ example: 'b3f1c2a0-1b3a-4b3a-9b3a-1b3a4b3a9b3a' })
  id!: string;

  @ApiProperty({ example: 'Wireless Headphones' })
  name!: string;

  @ApiProperty({ example: 'Over-ear, active noise cancellation.' })
  description!: string;

  @ApiProperty({ description: 'Price before tax, integer (COP has no decimals).', example: 350000 })
  unitPrice!: number;

  @ApiProperty({ description: 'IVA rate as a fraction — varies per product.', example: 0.19 })
  taxRate!: number;

  @ApiProperty({ example: 66500 })
  taxAmount!: number;

  @ApiProperty({ description: 'Tax-included unit price: unitPrice + taxAmount.', example: 416500 })
  price!: number;

  @ApiProperty({ example: 12 })
  stock!: number;

  @ApiProperty({ example: 'https://placehold.co/600x600', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: 5000 })
  baseFee!: number;

  @ApiProperty({ example: 8000 })
  deliveryFee!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;
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
