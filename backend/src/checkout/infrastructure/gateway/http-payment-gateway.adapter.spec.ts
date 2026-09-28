import type { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import { createHash } from 'crypto';
import { of, throwError } from 'rxjs';
import { HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';

describe('HttpPaymentGatewayAdapter', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENT_API_URL = 'https://api-sandbox.example-gateway.dev/v1';
    process.env.PAYMENT_PRIVATE_KEY = 'prv_test_123';
    process.env.PAYMENT_PUBLIC_KEY = 'pub_test_123';
    process.env.PAYMENT_INTEGRITY_SECRET = 'integrity_secret_test';
  });

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  function buildRequest() {
    return {
      reference: 'trx-ref-1',
      cardToken: 'tok_test_card',
      paymentAcceptanceToken: 'accept_token',
      personalDataAuthToken: 'accept_personal_token',
      customerEmail: 'jane@example.com',
      amount: 429500,
      currency: 'COP',
    };
  }

  function mockHttp(post: jest.Mock, get?: jest.Mock): HttpService {
    return { post, get } as unknown as HttpService;
  }

  function axiosResponse<T>(data: T): AxiosResponse<T> {
    return { data, status: 201, statusText: 'Created', headers: {}, config: {} as never };
  }

  it('sends the correctly-shaped request, including the integrity signature and auth header', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-1',
            status: 'APPROVED',
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: 'VISA', last_four: '4242' } },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    await adapter.charge(buildRequest());

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0] as [string, Record<string, unknown>, Record<string, unknown>];

    expect(url).toBe('https://api-sandbox.example-gateway.dev/v1/transactions');
    expect(body).toMatchObject({
      acceptance_token: 'accept_token',
      accept_personal_auth: 'accept_personal_token',
      amount_in_cents: 42950000,
      currency: 'COP',
      customer_email: 'jane@example.com',
      payment_method: { type: 'CARD', token: 'tok_test_card', installments: 1 },
      reference: 'trx-ref-1',
    });
    expect(body.signature).toBe(
      createHash('sha256').update('trx-ref-142950000COPintegrity_secret_test').digest('hex'),
    );
    expect((config.headers as Record<string, string>).Authorization).toBe('Bearer prv_test_123');
  });

  it('resolves to ChargeApproved on an APPROVED response', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-1',
            status: 'APPROVED',
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: 'VISA', last_four: '4242' } },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ gatewayReference: 'gw-trx-1', cardLast4: '4242', cardBrand: 'VISA' });
    }
  });

  it('errs with PaymentDeclined on a DECLINED response', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-2',
            status: 'DECLINED',
            status_message: 'INSUFFICIENT_FUNDS',
            payment_method: { type: 'CARD', extra: { brand: 'MASTERCARD', last_four: '1111' } },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('PAYMENT_DECLINED');
      if (result.error.type === 'PAYMENT_DECLINED') {
        expect(result.error.reason).toBe('INSUFFICIENT_FUNDS');
        expect(result.error.gatewayReference).toBe('gw-trx-2');
        expect(result.error.cardLast4).toBe('1111');
      }
    }
  });

  it('falls back to a generic reason when the gateway omits status_message on a decline', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-4',
            status: 'DECLINED',
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: 'VISA', last_four: '4242' } },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error.type === 'PAYMENT_DECLINED') {
      expect(result.error.reason).toBe('Declined by the payment gateway');
    }
  });

  it('falls back to no brand/last4 when the gateway omits `extra` entirely', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-6',
            status: 'APPROVED',
            status_message: null,
            payment_method: { type: 'CARD', extra: null },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual({ gatewayReference: 'gw-trx-6' });
  });

  it('errs with GatewayError for an unexpected status like VOIDED', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          data: {
            id: 'gw-trx-3',
            status: 'VOIDED',
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: null, last_four: null } },
          },
        }),
      ),
    );
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('GATEWAY_ERROR');
  });

  it('errs with GatewayError on a request timeout', async () => {
    const timeoutError = new AxiosError('timeout of 10000ms exceeded');
    timeoutError.code = 'ECONNABORTED';
    const post = jest.fn().mockReturnValue(throwError(() => timeoutError));
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('GATEWAY_ERROR');
      if (result.error.type === 'GATEWAY_ERROR') expect(result.error.reason).toMatch(/timed out/i);
    }
  });

  it('errs with GatewayError on a 5xx response from the gateway', async () => {
    const httpError = new AxiosError('Request failed with status code 502');
    httpError.response = axiosResponse({ error: 'bad gateway' }) as AxiosResponse;
    httpError.response.status = 502;
    const post = jest.fn().mockReturnValue(throwError(() => httpError));
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('GATEWAY_ERROR');
      if (result.error.type === 'GATEWAY_ERROR') expect(result.error.reason).toMatch(/502/);
    }
  });

  it('errs with GatewayError on a network error with no response (e.g. DNS/connection refused)', async () => {
    const networkError = new AxiosError('connect ECONNREFUSED');
    const post = jest.fn().mockReturnValue(throwError(() => networkError));
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.type).toBe('GATEWAY_ERROR');
  });

  it('errs with GatewayError on a non-Axios exception', async () => {
    const post = jest.fn().mockReturnValue(throwError(() => new Error('boom')));
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('GATEWAY_ERROR');
      if (result.error.type === 'GATEWAY_ERROR') expect(result.error.reason).toBe('boom');
    }
  });

  it('errs with a generic GatewayError message when the thrown value is not an Error', async () => {
    const post = jest.fn().mockReturnValue(throwError(() => 'not an error object'));
    const adapter = new HttpPaymentGatewayAdapter(mockHttp(post));

    const result = await adapter.charge(buildRequest());

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error.type === 'GATEWAY_ERROR') {
      expect(result.error.reason).toBe('Unknown payment gateway error');
    }
  });

  describe('charge polling (every charge starts PENDING)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function pendingResponse() {
      return of(
        axiosResponse({
          data: {
            id: 'gw-trx-5',
            status: 'PENDING' as const,
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: null, last_four: null } },
          },
        }),
      );
    }

    function approvedResponse() {
      return of(
        axiosResponse({
          data: {
            id: 'gw-trx-5',
            status: 'APPROVED' as const,
            status_message: null,
            payment_method: { type: 'CARD', extra: { brand: 'VISA', last_four: '4242' } },
          },
        }),
      );
    }

    it('polls GET /transactions/:id every 5s while PENDING, resolving once it settles', async () => {
      const post = jest.fn().mockReturnValue(pendingResponse());
      const get = jest.fn().mockReturnValueOnce(pendingResponse()).mockReturnValueOnce(approvedResponse());
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(post, get));

      const resultPromise = adapter.charge(buildRequest());

      expect(get).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(5_000);
      expect(get).toHaveBeenCalledTimes(1);
      const [url, config] = get.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe('https://api-sandbox.example-gateway.dev/v1/transactions/gw-trx-5');
      expect((config.headers as Record<string, string>).Authorization).toBe('Bearer prv_test_123');

      await jest.advanceTimersByTimeAsync(5_000);
      expect(get).toHaveBeenCalledTimes(2);

      const result = await resultPromise;
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toEqual({ gatewayReference: 'gw-trx-5', cardLast4: '4242', cardBrand: 'VISA' });
    });

    it('gives up after 10 status checks and errs, without polling an 11th time', async () => {
      const post = jest.fn().mockReturnValue(pendingResponse());
      const get = jest.fn().mockReturnValue(pendingResponse());
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(post, get));

      const resultPromise = adapter.charge(buildRequest());
      await jest.advanceTimersByTimeAsync(5_000 * 10);

      const result = await resultPromise;
      expect(get).toHaveBeenCalledTimes(10);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe('GATEWAY_ERROR');
        if (result.error.type === 'GATEWAY_ERROR') expect(result.error.reason).toMatch(/10 status checks/);
      }
    });

    it('stops polling and errs immediately if a status-check request fails', async () => {
      const post = jest.fn().mockReturnValue(pendingResponse());
      const get = jest.fn().mockReturnValueOnce(throwError(() => new Error('boom')));
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(post, get));

      const resultPromise = adapter.charge(buildRequest());
      await jest.advanceTimersByTimeAsync(5_000);

      const result = await resultPromise;
      expect(get).toHaveBeenCalledTimes(1);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe('GATEWAY_ERROR');
    });

    it('never polls when the charge resolves synchronously', async () => {
      const post = jest.fn().mockReturnValue(approvedResponse());
      const get = jest.fn();
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(post, get));

      await adapter.charge(buildRequest());

      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('getAcceptanceTokens', () => {
    it('fetches merchant info with the public key header and maps both tokens/permalinks', async () => {
      const get = jest.fn().mockReturnValue(
        of(
          axiosResponse({
            data: {
              presigned_acceptance: { acceptance_token: 'terms_token', permalink: 'https://x/terms.pdf', type: 'END_USER_POLICY' },
              presigned_personal_data_auth: {
                acceptance_token: 'personal_token',
                permalink: 'https://x/personal.pdf',
                type: 'PERSONAL_DATA_AUTH',
              },
            },
          }),
        ),
      );
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(jest.fn(), get));

      const result = await adapter.getAcceptanceTokens();

      expect(get).toHaveBeenCalledTimes(1);
      const [url, config] = get.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe('https://api-sandbox.example-gateway.dev/v1/merchants/info');
      expect((config.headers as Record<string, string>)['x-merchant-public-key']).toBe('pub_test_123');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          termsToken: 'terms_token',
          termsUrl: 'https://x/terms.pdf',
          personalDataToken: 'personal_token',
          personalDataUrl: 'https://x/personal.pdf',
        });
      }
    });

    it('errs with GatewayError on a request failure', async () => {
      const get = jest.fn().mockReturnValue(throwError(() => new Error('boom')));
      const adapter = new HttpPaymentGatewayAdapter(mockHttp(jest.fn(), get));

      const result = await adapter.getAcceptanceTokens();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.type).toBe('GATEWAY_ERROR');
    });
  });
});
