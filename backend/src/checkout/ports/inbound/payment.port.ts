import type { ResultAsync } from 'neverthrow';
import type { GatewayError } from '../../domain/errors';
import type { AcceptanceTokens } from '../outbound/payment-gateway.port';

export const PAYMENT_PORT = Symbol('PaymentPort');

export interface PaymentPort {
  /**
   * The habeas-data consent tokens the frontend must show as checkboxes on the
   * payment screen (see specs/PRD.md) before charging — fetched server-side
   * because the gateway's merchant-info endpoint doesn't support browser CORS.
   */
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, GatewayError>;
}
