export class GatewayError {
  readonly type = 'GATEWAY_ERROR' as const;

  constructor(readonly reason: string) {}

  get message(): string {
    return `Payment gateway error: ${this.reason}`;
  }
}
