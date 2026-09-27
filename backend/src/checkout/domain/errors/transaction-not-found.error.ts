export class TransactionNotFound {
  readonly type = 'TRANSACTION_NOT_FOUND' as const;

  constructor(readonly transactionId: string) {}

  get message(): string {
    return `Transaction ${this.transactionId} not found`;
  }
}
