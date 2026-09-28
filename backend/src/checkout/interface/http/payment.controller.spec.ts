import { HttpException, HttpStatus } from '@nestjs/common';
import { errAsync, okAsync } from 'neverthrow';
import { GatewayError } from '../../domain/errors';
import type { PaymentPort } from '../../ports/inbound/payment.port';
import type { AcceptanceTokens } from '../../ports/outbound/payment-gateway.port';
import { PaymentController } from './payment.controller';

const tokens: AcceptanceTokens = {
  termsToken: 'terms_tok',
  termsUrl: 'https://x/terms.pdf',
  personalDataToken: 'personal_tok',
  personalDataUrl: 'https://x/personal.pdf',
};

function fakePort(overrides: Partial<PaymentPort> = {}): PaymentPort {
  return { getAcceptanceTokens: () => okAsync(tokens), ...overrides };
}

describe('PaymentController.getAcceptanceTokens', () => {
  it('maps the gateway tokens/permalinks into the response shape', async () => {
    const controller = new PaymentController(fakePort());

    const result = await controller.getAcceptanceTokens();

    expect(result).toEqual(tokens);
  });

  it('throws a 502 HttpException on GatewayError', async () => {
    const controller = new PaymentController(
      fakePort({ getAcceptanceTokens: () => errAsync(new GatewayError('unreachable')) }),
    );

    await expect(controller.getAcceptanceTokens()).rejects.toThrow(HttpException);
    try {
      await controller.getAcceptanceTokens();
      throw new Error('expected getAcceptanceTokens() to throw');
    } catch (e) {
      if (e instanceof HttpException) {
        expect(e.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        expect((e.getResponse() as { errorCode: string }).errorCode).toBe('GATEWAY_ERROR');
      }
    }
  });
});
