import type { TransactionDetail, TransactionStatus } from '../../domain/entities';
import type { CreateTransactionCommand } from '../../ports/inbound/transactions.port';
import type { CreateTransactionDto } from './dto/create-transaction.dto';

export interface AmountResponse {
  readonly unitPrice: number;
  readonly quantity: number;
  readonly subtotal: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly product: number;
  readonly baseFee: number;
  readonly deliveryFee: number;
  readonly total: number;
  readonly currency: string;
}

export interface CardResponse {
  readonly brand: string | null;
  readonly last4: string | null;
}

export interface TransactionResponse {
  readonly transactionId: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly card: CardResponse | null;
  readonly reason?: string;
  readonly amount: AmountResponse;
  readonly createdAt: string;
}

export interface TransactionDetailResponse extends TransactionResponse {
  readonly customer: { firstName: string; lastName: string; email: string; phone: string };
  readonly delivery: { address: string; city: string; region: string | null; postalCode: string | null; notes: string | null };
}

export function toCommand(dto: CreateTransactionDto): CreateTransactionCommand {
  return {
    idempotencyKey: dto.idempotencyKey,
    productId: dto.productId,
    quantity: dto.quantity,
    cardToken: dto.cardToken,
    paymentAcceptanceToken: dto.paymentAcceptanceToken,
    customer: { ...dto.customer },
    delivery: { ...dto.delivery },
  };
}

// `payment.errorReason` holds the raw technical detail (network/axios error
// message) for our own records — API-CONTRACT.md is explicit that a technical
// failure's client-facing reason must be generic, never a raw exception. A
// DECLINED reason, in contrast, comes from the gateway's own business response
// and is meant to be shown to the customer as-is.
const GENERIC_ERROR_REASON = 'A technical error occurred while processing the payment';

function toReason(status: TransactionStatus, payment: TransactionDetail['payment']): string | undefined {
  if (status === 'DECLINED') return payment?.declineReason ?? undefined;
  if (status === 'ERROR') return GENERIC_ERROR_REASON;
  return undefined;
}

export function toTransactionDetailResponse(detail: TransactionDetail): TransactionDetailResponse {
  const { transaction, customer, delivery, payment } = detail;
  const props = transaction.toProps();
  const reason = toReason(props.status, payment);

  return {
    transactionId: props.id,
    reference: props.reference,
    status: props.status,
    card: payment ? { brand: payment.cardBrand, last4: payment.cardLast4 } : null,
    ...(reason ? { reason } : {}),
    amount: {
      unitPrice: props.unitPriceAmount,
      quantity: props.quantity,
      subtotal: props.subtotalAmount,
      taxRate: props.taxRate,
      taxAmount: props.taxAmount,
      product: props.productAmount,
      baseFee: props.baseFeeAmount,
      deliveryFee: props.deliveryFeeAmount,
      total: props.totalAmount,
      currency: props.currency,
    },
    createdAt: props.createdAt.toISOString(),
    customer: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone },
    delivery: { address: delivery.address, city: delivery.city, region: delivery.region, postalCode: delivery.postalCode, notes: delivery.notes },
  };
}
