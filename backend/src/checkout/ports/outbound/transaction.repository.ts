import type { ResultAsync } from 'neverthrow';
import type { Transaction, TransactionStatus } from '../../domain/entities';
import type { OutOfStock, ProductNotFound, RepositoryError, TransactionNotFound } from '../../domain/errors';

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');

export interface NewTransactionCustomer {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}

export interface NewTransactionDelivery {
  readonly address: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode?: string;
  readonly notes?: string;
}

/**
 * Everything needed to create the PENDING transaction, its customer and its
 * delivery in one atomic write, reserving stock in the same operation (see ADR
 * 0001). Money fields are pre-computed by the application layer (via `Money`) —
 * the repository never does pricing math, only persistence.
 */
export interface NewTransactionData {
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly unitPriceAmount: number;
  readonly subtotalAmount: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly productAmount: number;
  readonly baseFeeAmount: number;
  readonly deliveryFeeAmount: number;
  readonly totalAmount: number;
  readonly currency: string;
  readonly customer: NewTransactionCustomer;
  readonly delivery: NewTransactionDelivery;
}

export interface PaymentOutcome {
  readonly cardLast4?: string;
  readonly cardBrand?: string;
  readonly gatewayReference?: string;
  readonly declineReason?: string;
  readonly errorReason?: string;
}

/**
 * Resolves a PENDING transaction. `status` must be one of the non-PENDING
 * states — the adapter enforces the conditional `WHERE status = 'PENDING'`
 * update and restores the stock reservation for anything other than APPROVED
 * (see ADR 0001), all inside one DB transaction alongside the `payments` write.
 */
export interface TransactionResolution {
  readonly status: Exclude<TransactionStatus, 'PENDING'>;
  readonly payment: PaymentOutcome;
}

export interface TransactionRepository {
  findByIdempotencyKey(key: string): ResultAsync<Transaction | null, RepositoryError>;
  createPending(data: NewTransactionData): ResultAsync<Transaction, OutOfStock | ProductNotFound | RepositoryError>;
  updateResult(id: string, resolution: TransactionResolution): ResultAsync<Transaction, RepositoryError>;
  findById(id: string): ResultAsync<Transaction, TransactionNotFound>;
}
