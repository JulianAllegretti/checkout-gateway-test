import { Injectable } from '@nestjs/common';
import type { Product as ProductRow } from '@prisma/client';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { Product } from '../../domain/entities';
import { ProductNotFound } from '../../domain/errors';
import type { ProductRepository } from '../../ports/outbound/product.repository';
import { decimalToNumber } from './decimal';
import { PrismaService } from './prisma.service';

function toDomain(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitPriceAmount: row.unitPriceAmount,
    taxRate: decimalToNumber(row.taxRate),
    stock: row.stock,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    currency: row.currency,
  };
}

@Injectable()
export class ProductRepositoryPrisma implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFeatured(): ResultAsync<Product, ProductNotFound> {
    return ResultAsync.fromPromise(
      this.prisma.product.findFirst({ where: { isFeatured: true } }),
      () => new ProductNotFound('featured'),
    ).andThen((row) => (row ? okAsync(toDomain(row)) : errAsync(new ProductNotFound('featured'))));
  }

  findById(id: string): ResultAsync<Product, ProductNotFound> {
    return ResultAsync.fromPromise(
      this.prisma.product.findUnique({ where: { id } }),
      () => new ProductNotFound(id),
    ).andThen((row) => (row ? okAsync(toDomain(row)) : errAsync(new ProductNotFound(id))));
  }
}
