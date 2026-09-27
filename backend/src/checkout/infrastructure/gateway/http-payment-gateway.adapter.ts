import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { createHash } from 'crypto';
import { err, ok, ResultAsync, type Result } from 'neverthrow';
import { firstValueFrom } from 'rxjs';
import { GatewayError, PaymentDeclined } from '../../domain/errors';
import type { ChargeApproved, ChargeRequest, PaymentGatewayPort } from '../../ports/outbound/payment-gateway.port';

type GatewayTransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

interface GatewayChargeResponseBody {
  data: {
    id: string;
    status: GatewayTransactionStatus;
    status_message: string | null;
    payment_method: {
      type: string;
      brand: string | null;
      last_four: string | null;
    };
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class HttpPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly http: HttpService) {}

  charge(req: ChargeRequest): ResultAsync<ChargeApproved, PaymentDeclined | GatewayError> {
    const amountInCents = req.amount * 100;

    const body = {
      acceptance_token: req.paymentAcceptanceToken,
      amount_in_cents: amountInCents,
      currency: req.currency,
      customer_email: req.customerEmail,
      payment_method: { type: 'CARD' as const, token: req.cardToken, installments: 1 },
      reference: req.reference,
      signature: buildIntegritySignature(req.reference, amountInCents, req.currency),
    };

    const request = firstValueFrom(
      this.http.post<GatewayChargeResponseBody>(`${process.env.PAYMENT_API_URL}/transactions`, body, {
        headers: { Authorization: `Bearer ${process.env.PAYMENT_PRIVATE_KEY}` },
        timeout: REQUEST_TIMEOUT_MS,
      }),
    );

    return ResultAsync.fromPromise(request, toGatewayError).andThen((response) => toChargeResult(response.data.data));
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
  const cardLast4 = data.payment_method.last_four ?? undefined;
  const cardBrand = data.payment_method.brand ?? undefined;

  switch (data.status) {
    case 'APPROVED':
      return ok({ gatewayReference: data.id, cardLast4, cardBrand });
    case 'DECLINED':
      return err(new PaymentDeclined(data.status_message ?? 'Declined by the payment gateway', data.id, cardLast4, cardBrand));
    default:
      // PENDING/VOIDED/ERROR: this app only charges cards, which the gateway
      // resolves synchronously — any other status here means the gateway didn't
      // behave as expected, which is a technical failure, not a customer decline.
      return err(new GatewayError(`Unexpected transaction status from gateway: ${data.status}`));
  }
}

function toGatewayError(e: unknown): GatewayError {
  if (isAxiosError(e)) {
    if (e.response) return new GatewayError(`Payment gateway responded with HTTP ${e.response.status}`);
    if (e.code === 'ECONNABORTED') return new GatewayError('Payment gateway request timed out');
    return new GatewayError(e.message);
  }
  return new GatewayError(e instanceof Error ? e.message : 'Unknown payment gateway error');
}
