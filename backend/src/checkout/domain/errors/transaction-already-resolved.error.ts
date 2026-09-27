import type { TransactionStatus } from '../entities/transaction.entity';

export class TransactionAlreadyResolved {
  readonly type = 'TRANSACTION_ALREADY_RESOLVED' as const;

  constructor(
    readonly transactionId: string,
    readonly currentStatus: TransactionStatus,
  ) {}

  get message(): string {
    return `Transaction ${this.transactionId} is already ${this.currentStatus}`;
  }
}
