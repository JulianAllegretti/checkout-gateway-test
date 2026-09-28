import type { Customer } from './customer.entity';
import type { Delivery } from './delivery.entity';
import type { Payment } from './payment.entity';
import type { Transaction } from './transaction.entity';

/**
 * A transaction plus the related rows needed to render the status screen
 * (`GET /transactions/:id`). `payment` is null while the transaction is still
 * PENDING — the gateway hasn't resolved it yet, so there's no payment row.
 */
export interface TransactionDetail {
  readonly transaction: Transaction;
  readonly customer: Customer;
  readonly delivery: Delivery;
  readonly payment: Payment | null;
}
