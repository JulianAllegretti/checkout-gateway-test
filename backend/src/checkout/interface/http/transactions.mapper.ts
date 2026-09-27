import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TransactionDetail, TransactionStatus } from '../../domain/entities';
import type { CreateTransactionCommand } from '../../ports/inbound/transactions.port';
import type { CreateTransactionDto } from './dto/create-transaction.dto';

// Classes, not interfaces: @nestjs/swagger reads response shapes via
// reflection, and interfaces are erased at compile time — there'd be nothing
// left for it to introspect.
export class AmountResponse {
  @ApiProperty({ example: 350000 })
  unitPrice!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 700000 })
  subtotal!: number;

  @ApiProperty({ example: 0.19 })
  taxRate!: number;

  @ApiProperty({ example: 133000 })
  taxAmount!: number;

  @ApiProperty({ description: 'subtotal + taxAmount', example: 833000 })
  product!: number;

  @ApiProperty({ example: 5000 })
  baseFee!: number;

  @ApiProperty({ example: 8000 })
  deliveryFee!: number;

  @ApiProperty({ description: 'product + baseFee + deliveryFee', example: 846000 })
  total!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;
}

export class CardResponse {
  @ApiProperty({ example: 'VISA', nullable: true })
  brand!: string | null;

  @ApiProperty({ example: '4242', nullable: true })
  last4!: string | null;
}

export class TransactionCustomerSummary {
  @ApiProperty({ example: 'Jane' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ example: '+573001234567' })
  phone!: string;
}

export class TransactionDeliverySummary {
  @ApiProperty({ example: 'Calle 123 #45-67' })
  address!: string;

  @ApiProperty({ example: 'Bogotá' })
  city!: string;

  @ApiProperty({ example: 'Cundinamarca', nullable: true })
  region!: string | null;

  @ApiProperty({ example: '110111', nullable: true })
  postalCode!: string | null;

  @ApiProperty({ example: 'Apt 4B', nullable: true })
  notes!: string | null;
}

export class TransactionResponse {
  @ApiProperty({ example: '8a2e...-uuid' })
  transactionId!: string;

  @ApiProperty({ example: 'TRX-000123' })
  reference!: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'DECLINED', 'ERROR', 'VOIDED'] })
  status!: TransactionStatus;

  @ApiProperty({ type: CardResponse, nullable: true })
  card!: CardResponse | null;

  @ApiPropertyOptional({
    description: 'Present only when status is DECLINED or ERROR. Never a raw exception — a generic message for technical failures.',
    example: 'insufficient_funds',
  })
  reason?: string;

  @ApiProperty({ type: AmountResponse })
  amount!: AmountResponse;

  @ApiProperty({ example: '2026-09-25T14:03:00.000Z' })
  createdAt!: string;
}

export class TransactionDetailResponse extends TransactionResponse {
  @ApiProperty({ type: TransactionCustomerSummary })
  customer!: TransactionCustomerSummary;

  @ApiProperty({ type: TransactionDeliverySummary })
  delivery!: TransactionDeliverySummary;
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
