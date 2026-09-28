import type { ResultAsync } from 'neverthrow';
import type { GatewayError, PaymentDeclined } from '../../domain/errors';

export const PAYMENT_GATEWAY = Symbol('PaymentGatewayPort');

export interface ChargeRequest {
  readonly reference: string;
  readonly cardToken: string;
  readonly paymentAcceptanceToken: string;
  readonly personalDataAuthToken: string;
  readonly customerEmail: string;
  readonly amount: number;
  readonly currency: string;
}

export interface ChargeApproved {
  readonly gatewayReference: string;
  readonly cardLast4?: string;
  readonly cardBrand?: string;
}

export interface AcceptanceTokens {
  readonly termsToken: string;
  readonly termsUrl: string;
  readonly personalDataToken: string;
  readonly personalDataUrl: string;
}

/**
 * A declined charge is a normal business outcome, not a technical failure — it
 * flows through `PaymentDeclined` in the error channel (see ADR 0001) so the
 * whole `TransactionsService.create` chain shares one error union and one
 * exhaustive switch at the controller boundary. Only network/timeout/5xx
 * failures are `GatewayError`.
 */
export interface PaymentGatewayPort {
  charge(req: ChargeRequest): ResultAsync<ChargeApproved, PaymentDeclined | GatewayError>;
  /**
   * The pair of habeas-data consent tokens the gateway requires on every charge
   * (see specs/decisions — the merchant-info endpoint has no browser CORS
   * support, so this must be fetched server-side and handed to the frontend,
   * not called directly from it like tokenization is).
   */
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, GatewayError>;
}
