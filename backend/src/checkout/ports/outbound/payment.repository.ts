import type { ResultAsync } from 'neverthrow';
import type { Payment } from '../../domain/entities';
import type { RepositoryError } from '../../domain/errors';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');

export interface PaymentRepository {
  /** Reads only — the payment row is written by `TransactionRepository.updateResult`. */
  findByTransactionId(transactionId: string): ResultAsync<Payment, RepositoryError>;
}
