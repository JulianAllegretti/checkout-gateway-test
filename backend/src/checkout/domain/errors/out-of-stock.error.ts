export class OutOfStock {
  readonly type = 'OUT_OF_STOCK' as const;

  constructor(
    readonly productId: string,
    readonly requestedQuantity: number,
  ) {}

  get message(): string {
    return `Product ${this.productId} does not have ${this.requestedQuantity} unit(s) available`;
  }
}
