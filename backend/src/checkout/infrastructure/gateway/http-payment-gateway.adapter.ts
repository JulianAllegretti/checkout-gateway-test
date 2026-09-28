import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { createHash } from 'crypto';
import { err, ok, ResultAsync, type Result } from 'neverthrow';
import { firstValueFrom } from 'rxjs';
import { GatewayError, PaymentDeclined } from '../../domain/errors';
import type {
  AcceptanceTokens,
  ChargeApproved,
  ChargeRequest,
  PaymentGatewayPort,
} from '../../ports/outbound/payment-gateway.port';

type GatewayTransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

interface GatewayChargeResponseBody {
  data: {
    id: string;
    status: GatewayTransactionStatus;
    status_message: string | null;
    // Confirmed against the real sandbox: brand/last_four live under `extra`
    // on both the creation and status-check responses, never directly on
    // payment_method — `extra` can apparently be absent on read paths where
    // the card was never fully processed.
    payment_method: {
      type: string;
      extra: { brand: string | null; last_four: string | null } | null;
    };
  };
}

interface GatewayMerchantInfoResponseBody {
  data: {
    presigned_acceptance: { acceptance_token: string; permalink: string; type: string };
    presigned_personal_data_auth: { acceptance_token: string; permalink: string; type: string };
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

// Confirmed against the real sandbox: a freshly-created transaction is always
// PENDING — it never resolves synchronously on the creation call itself, only
// once its own status endpoint is polled (see the gateway's own transaction
// status documentation). The gateway's own recommendation is a webhook
// (`transaction.updated`) instead of polling, but that needs a publicly
// reachable endpoint and signature verification — out of scope here, so this
// polls synchronously within the same request instead.
const POLL_MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 5_000;

@Injectable()
export class HttpPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly http: HttpService) {}

  charge(req: ChargeRequest): ResultAsync<ChargeApproved, PaymentDeclined | GatewayError> {
    return new ResultAsync(this.chargeAndPoll(req));
  }

  private async chargeAndPoll(req: ChargeRequest): Promise<Result<ChargeApproved, PaymentDeclined | GatewayError>> {
    const amountInCents = req.amount * 100;

    const body = {
      acceptance_token: req.paymentAcceptanceToken,
      accept_personal_auth: req.personalDataAuthToken,
      amount_in_cents: amountInCents,
      currency: req.currency,
      customer_email: req.customerEmail,
      payment_method: { type: 'CARD' as const, token: req.cardToken, installments: 1 },
      reference: req.reference,
      signature: buildIntegritySignature(req.reference, amountInCents, req.currency),
    };

    let data: GatewayChargeResponseBody['data'];
    try {
      const created = await firstValueFrom(
        this.http.post<GatewayChargeResponseBody>(`${process.env.PAYMENT_API_URL}/transactions`, body, {
          headers: { Authorization: `Bearer ${process.env.PAYMENT_PRIVATE_KEY}` },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      data = created.data.data;
    } catch (e) {
      return err(toGatewayError(e));
    }

    for (let attempt = 0; data.status === 'PENDING' && attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const polled = await firstValueFrom(
          this.http.get<GatewayChargeResponseBody>(`${process.env.PAYMENT_API_URL}/transactions/${data.id}`, {
            headers: { Authorization: `Bearer ${process.env.PAYMENT_PRIVATE_KEY}` },
            timeout: REQUEST_TIMEOUT_MS,
          }),
        );
        data = polled.data.data;
      } catch (e) {
        return err(toGatewayError(e));
      }
    }

    return toChargeResult(data);
  }

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, GatewayError> {
    const request = firstValueFrom(
      this.http.get<GatewayMerchantInfoResponseBody>(`${process.env.PAYMENT_API_URL}/merchants/info`, {
        headers: { 'x-merchant-public-key': process.env.PAYMENT_PUBLIC_KEY },
        timeout: REQUEST_TIMEOUT_MS,
      }),
    );

    return ResultAsync.fromPromise(request, toGatewayError).map((response) => ({
      termsToken: response.data.data.presigned_acceptance.acceptance_token,
      termsUrl: response.data.data.presigned_acceptance.permalink,
      personalDataToken: response.data.data.presigned_personal_data_auth.acceptance_token,
      personalDataUrl: response.data.data.presigned_personal_data_auth.permalink,
    }));
  }
}

/**
 * Required by the gateway on every transaction-creation call: SHA256 of
 * reference + amount_in_cents + currency + the integrity secret, concatenated
 * with no separator (same formula used for its Web Checkout integrity signature).
 */
function buildIntegritySignature(reference: string, amountInCents: number, currency: string): string {
  const raw = `${reference}${amountInCents}${currency}${process.env.PAYMENT_INTEGRITY_SECRET}`;
  return createHash('sha256').update(raw).digest('hex');
}

function toChargeResult(
  data: GatewayChargeResponseBody['data'],
): Result<ChargeApproved, PaymentDeclined | GatewayError> {
  const cardLast4 = data.payment_method.extra?.last_four ?? undefined;
  const cardBrand = data.payment_method.extra?.brand ?? undefined;

  switch (data.status) {
    case 'APPROVED':
      return ok({ gatewayReference: data.id, cardLast4, cardBrand });
    case 'DECLINED':
      return err(new PaymentDeclined(data.status_message ?? 'Declined by the payment gateway', data.id, cardLast4, cardBrand));
    case 'PENDING':
      // Every charge starts PENDING and is polled until it resolves (see
      // chargeAndPoll) — reaching this case means it never did within
      // POLL_MAX_ATTEMPTS, a technical failure, not a customer decline.
      return err(new GatewayError(`Payment gateway did not resolve the charge after ${POLL_MAX_ATTEMPTS} status checks`));
    default:
      // VOIDED/ERROR: not a customer decline, a technical failure.
      return err(new GatewayError(`Unexpected transaction status from gateway: ${data.status}`));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGatewayError(e: unknown): GatewayError {
  if (isAxiosError(e)) {
    if (e.response) return new GatewayError(`Payment gateway responded with HTTP ${e.response.status}`);
    if (e.code === 'ECONNABORTED') return new GatewayError('Payment gateway request timed out');
    return new GatewayError(e.message);
  }
  return new GatewayError(e instanceof Error ? e.message : 'Unknown payment gateway error');
}
