import { Injectable } from '@nestjs/common';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { Product } from '../../domain/entities';
import { ProductNotFound } from '../../domain/errors';
import type { ProductRepository } from '../../ports/outbound/product.repository';
import { productToDomain as toDomain } from './mappers';
import { PrismaService } from './prisma.service';

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
