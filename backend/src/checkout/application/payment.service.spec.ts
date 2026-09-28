import { errAsync, okAsync } from 'neverthrow';
import { GatewayError } from '../domain/errors';
import type { AcceptanceTokens, PaymentGatewayPort } from '../ports/outbound/payment-gateway.port';
import { PaymentService } from './payment.service';

const tokens: AcceptanceTokens = {
  termsToken: 'terms_tok',
  termsUrl: 'https://x/terms.pdf',
  personalDataToken: 'personal_tok',
  personalDataUrl: 'https://x/personal.pdf',
};

function fakePaymentGateway(overrides: Partial<PaymentGatewayPort> = {}): PaymentGatewayPort {
  return {
    charge: () => okAsync({ gatewayReference: 'gw-1' }),
    getAcceptanceTokens: () => okAsync(tokens),
    ...overrides,
  };
}

describe('PaymentService.getAcceptanceTokens', () => {
  it('returns the tokens from the gateway', async () => {
    const service = new PaymentService(fakePaymentGateway());

    const result = await service.getAcceptanceTokens();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(tokens);
  });

  it('propagates a GatewayError', async () => {
    const service = new PaymentService(
      fakePaymentGateway({ getAcceptanceTokens: () => errAsync(new GatewayError('unreachable')) }),
    );

    const result = await service.getAcceptanceTokens();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('GATEWAY_ERROR');
  });
});
