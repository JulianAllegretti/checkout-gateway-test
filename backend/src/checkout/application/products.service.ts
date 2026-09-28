import { Inject, Injectable } from '@nestjs/common';
import type { ResultAsync } from 'neverthrow';
import type { Product } from '../domain/entities';
import type { ProductNotFound, RepositoryError } from '../domain/errors';
import type { ProductsPort } from '../ports/inbound/products.port';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../ports/outbound/product.repository';

@Injectable()
export class ProductsService implements ProductsPort {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository) {}

  getCurrent(): ResultAsync<Product, ProductNotFound | RepositoryError> {
    return this.productRepository.findFeatured();
  }
}
