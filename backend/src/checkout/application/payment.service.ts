import { Inject, Injectable } from '@nestjs/common';
import type { ResultAsync } from 'neverthrow';
import type { GatewayError } from '../domain/errors';
import type { PaymentPort } from '../ports/inbound/payment.port';
import { PAYMENT_GATEWAY, type AcceptanceTokens, type PaymentGatewayPort } from '../ports/outbound/payment-gateway.port';

@Injectable()
export class PaymentService implements PaymentPort {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGatewayPort) {}

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, GatewayError> {
    return this.paymentGateway.getAcceptanceTokens();
  }
}
