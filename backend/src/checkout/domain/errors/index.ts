export * from './validation-error';
export * from './product-not-found.error';
export * from './transaction-not-found.error';
export * from './out-of-stock.error';
export * from './transaction-already-resolved.error';
export * from './invalid-transition.error';
export * from './payment-declined.error';
export * from './gateway.error';

import { GatewayError } from './gateway.error';
import { InvalidTransition } from './invalid-transition.error';
import { OutOfStock } from './out-of-stock.error';
import { PaymentDeclined } from './payment-declined.error';
import { ProductNotFound } from './product-not-found.error';
import { TransactionAlreadyResolved } from './transaction-already-resolved.error';
import { TransactionNotFound } from './transaction-not-found.error';
import { ValidationError } from './validation-error';

export type DomainError =
  | ValidationError
  | ProductNotFound
  | TransactionNotFound
  | OutOfStock
  | TransactionAlreadyResolved
  | InvalidTransition
  | PaymentDeclined
  | GatewayError;
