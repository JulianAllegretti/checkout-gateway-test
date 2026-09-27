import type { ResultAsync } from 'neverthrow';
import type { Transaction, TransactionDetail } from '../../domain/entities';
import type {
  GatewayError,
  OutOfStock,
  PaymentDeclined,
  ProductNotFound,
  TransactionNotFound,
  ValidationError,
} from '../../domain/errors';

export const TRANSACTIONS_PORT = Symbol('TransactionsPort');

export interface CreateTransactionCustomer {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}

export interface CreateTransactionDelivery {
  readonly address: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode?: string;
  readonly notes?: string;
}

export interface CreateTransactionCommand {
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly cardToken: string;
  readonly paymentAcceptanceToken: string;
  readonly customer: CreateTransactionCustomer;
  readonly delivery: CreateTransactionDelivery;
}

export type CreateTransactionError =
  | ValidationError
  | ProductNotFound
  | OutOfStock
  | PaymentDeclined
  | GatewayError;

export interface TransactionsPort {
  create(cmd: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError>;
  getById(id: string): ResultAsync<TransactionDetail, TransactionNotFound>;
}
