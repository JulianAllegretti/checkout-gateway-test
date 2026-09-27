export interface Delivery {
  readonly id: string;
  readonly transactionId: string;
  readonly address: string;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly notes: string | null;
}
