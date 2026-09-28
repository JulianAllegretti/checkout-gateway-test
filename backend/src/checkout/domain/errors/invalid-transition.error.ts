import type { TransactionStatus } from '../entities/transaction.entity';

export class InvalidTransition {
  readonly type = 'INVALID_TRANSITION' as const;

  constructor(
    readonly from: TransactionStatus,
    readonly to: TransactionStatus,
  ) {}

  get message(): string {
    return `Cannot transition transaction from ${this.from} to ${this.to}`;
  }
}
