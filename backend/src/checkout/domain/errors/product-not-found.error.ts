export class ProductNotFound {
  readonly type = 'PRODUCT_NOT_FOUND' as const;

  constructor(readonly productId: string) {}

  get message(): string {
    return `Product ${this.productId} not found`;
  }
}
