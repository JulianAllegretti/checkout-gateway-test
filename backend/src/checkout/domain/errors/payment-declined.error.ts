export class PaymentDeclined {
  readonly type = 'PAYMENT_DECLINED' as const;

  constructor(
    readonly reason: string,
    readonly gatewayReference?: string,
    readonly cardLast4?: string,
    readonly cardBrand?: string,
  ) {}

  get message(): string {
    return `Payment declined: ${this.reason}`;
  }
}
