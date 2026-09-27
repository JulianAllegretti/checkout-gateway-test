import type { ResultAsync } from 'neverthrow';
import type { Product } from '../../domain/entities';
import type { ProductNotFound } from '../../domain/errors';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

export interface ProductRepository {
  /** The single product the storefront shows (`is_featured = true`). */
  findFeatured(): ResultAsync<Product, ProductNotFound>;
  findById(id: string): ResultAsync<Product, ProductNotFound>;
}
