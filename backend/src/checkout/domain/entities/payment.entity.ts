export interface Payment {
  readonly id: string;
  readonly transactionId: string;
  readonly cardLast4: string | null;
  readonly cardBrand: string | null;
  readonly gatewayReference: string | null;
  readonly declineReason: string | null;
  readonly errorReason: string | null;
}
