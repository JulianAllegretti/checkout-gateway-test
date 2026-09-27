import { err, ok, type Result } from 'neverthrow';
import { InvalidTransition } from '../errors/invalid-transition.error';

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED';

// All four resolutions are reachable directly from PENDING; every one of them is
// final (see ADR 0001's state diagram — no transition ever leaves an already
// resolved transaction).
const ALLOWED_TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  PENDING: ['APPROVED', 'DECLINED', 'ERROR', 'VOIDED'],
  APPROVED: [],
  DECLINED: [],
  ERROR: [],
  VOIDED: [],
};

export interface TransactionProps {
  readonly id: string;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly customerId: string;
  readonly status: TransactionStatus;
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
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Transaction {
  constructor(private readonly props: TransactionProps) {}

  get id(): string {
    return this.props.id;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  toProps(): TransactionProps {
    return this.props;
  }

  isResolved(): boolean {
    return this.props.status !== 'PENDING';
  }

  transitionTo(next: TransactionStatus): Result<Transaction, InvalidTransition> {
    const allowed = ALLOWED_TRANSITIONS[this.props.status];
    if (!allowed.includes(next)) {
      return err(new InvalidTransition(this.props.status, next));
    }
    return ok(new Transaction({ ...this.props, status: next, updatedAt: new Date() }));
  }
}
