import type { ResultAsync } from 'neverthrow';
import type { Product } from '../../domain/entities';
import type { ProductNotFound } from '../../domain/errors';

export const PRODUCTS_PORT = Symbol('ProductsPort');

export interface ProductsPort {
  getCurrent(): ResultAsync<Product, ProductNotFound>;
}
