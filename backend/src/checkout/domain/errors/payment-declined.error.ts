export class PaymentDeclined {
  readonly type = 'PAYMENT_DECLINED' as const;

  constructor(readonly reason: string) {}

  get message(): string {
    return `Payment declined: ${this.reason}`;
  }
}
