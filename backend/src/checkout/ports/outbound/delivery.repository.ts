import type { ResultAsync } from 'neverthrow';
import type { Delivery } from '../../domain/entities';
import type { RepositoryError } from '../../domain/errors';

export const DELIVERY_REPOSITORY = Symbol('DeliveryRepository');

export interface DeliveryRepository {
  /** Reads only — deliveries are created as part of `TransactionRepository.createPending`. */
  findByTransactionId(transactionId: string): ResultAsync<Delivery, RepositoryError>;
}
