import type { ResultAsync } from 'neverthrow';
import type { Customer } from '../../domain/entities';
import type { RepositoryError } from '../../domain/errors';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

export interface CustomerRepository {
  /** Reads only — customers are created as part of `TransactionRepository.createPending`. */
  findById(id: string): ResultAsync<Customer, RepositoryError>;
}
