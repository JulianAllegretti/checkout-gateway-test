import { Inject, Injectable } from '@nestjs/common';
import { err, errAsync, okAsync, ResultAsync, type Result } from 'neverthrow';
import { Money } from '../domain/value-objects/money';
import type { Product, Transaction, TransactionDetail } from '../domain/entities';
import { ValidationError, type RepositoryError, type TransactionNotFound } from '../domain/errors';
import type {
  CreateTransactionCommand,
  CreateTransactionError,
  TransactionsPort,
} from '../ports/inbound/transactions.port';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../ports/outbound/product.repository';
import { PAYMENT_GATEWAY, type PaymentGatewayPort } from '../ports/outbound/payment-gateway.port';
import {
  TRANSACTION_REPOSITORY,
  type NewTransactionData,
  type TransactionRepository,
} from '../ports/outbound/transaction.repository';

interface Amounts {
  readonly unitPriceAmount: number;
  readonly subtotalAmount: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly productAmount: number;
  readonly baseFeeAmount: number;
  readonly deliveryFeeAmount: number;
  readonly totalAmount: number;
  readonly currency: string;
}

function computeAmounts(product: Product, quantity: number): Amounts {
  const unitPrice = Money.of(product.unitPriceAmount, product.currency);
  const subtotal = unitPrice.multiply(quantity);
  const tax = subtotal.multiply(product.taxRate);
  const productAmount = subtotal.add(tax);
  const baseFee = Money.of(Number(process.env.BASE_FEE_AMOUNT), product.currency);
  const deliveryFee = Money.of(Number(process.env.DELIVERY_FEE_AMOUNT), product.currency);
  const total = productAmount.add(baseFee).add(deliveryFee);

  return {
    unitPriceAmount: unitPrice.amount,
    subtotalAmount: subtotal.amount,
    taxRate: product.taxRate,
    taxAmount: tax.amount,
    productAmount: productAmount.amount,
    baseFeeAmount: baseFee.amount,
    deliveryFeeAmount: deliveryFee.amount,
    totalAmount: total.amount,
    currency: product.currency,
  };
}

function toNewTransactionData(cmd: CreateTransactionCommand, product: Product): NewTransactionData {
  return {
    // Reusing the client's idempotency key as the gateway-facing reference means a
    // retried request (same key) also reaches the gateway as the same reference,
    // instead of looking like a second, distinct charge attempt.
    reference: cmd.idempotencyKey,
    idempotencyKey: cmd.idempotencyKey,
    productId: product.id,
    quantity: cmd.quantity,
    ...computeAmounts(product, cmd.quantity),
    customer: cmd.customer,
    delivery: cmd.delivery,
  };
}

@Injectable()
export class TransactionsService implements TransactionsPort {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactionRepository: TransactionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  create(cmd: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError> {
    if (!Number.isInteger(cmd.quantity) || cmd.quantity < 1) {
      return errAsync(new ValidationError(`quantity must be a positive integer, got ${cmd.quantity}`));
    }

    return this.transactionRepository
      .findByIdempotencyKey(cmd.idempotencyKey)
      .andThen((existing) => (existing ? okAsync(existing) : this.createAndCharge(cmd)));
  }

  getById(id: string): ResultAsync<TransactionDetail, TransactionNotFound | RepositoryError> {
    return this.transactionRepository.findByIdWithDetails(id);
  }

  private createAndCharge(cmd: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError> {
    return this.productRepository
      .findById(cmd.productId)
      .andThen((product) => this.transactionRepository.createPending(toNewTransactionData(cmd, product)))
      .andThen((pending) => this.chargeAndResolve(pending, cmd));
  }

  private chargeAndResolve(
    pending: Transaction,
    cmd: CreateTransactionCommand,
  ): ResultAsync<Transaction, CreateTransactionError> {
    const props = pending.toProps();

    const run = async (): Promise<Result<Transaction, CreateTransactionError>> => {
      const charged = await this.paymentGateway.charge({
        reference: props.reference,
        cardToken: cmd.cardToken,
        paymentAcceptanceToken: cmd.paymentAcceptanceToken,
        customerEmail: cmd.customer.email,
        amount: props.totalAmount,
        currency: props.currency,
      });

      if (charged.isOk()) {
        return this.resolve(pending, 'APPROVED', {
          gatewayReference: charged.value.gatewayReference,
          cardLast4: charged.value.cardLast4,
          cardBrand: charged.value.cardBrand,
        });
      }

      const chargeError = charged.error;
      const status = chargeError.type === 'PAYMENT_DECLINED' ? 'DECLINED' : 'ERROR';
      const payment =
        chargeError.type === 'PAYMENT_DECLINED'
          ? {
              gatewayReference: chargeError.gatewayReference,
              cardLast4: chargeError.cardLast4,
              cardBrand: chargeError.cardBrand,
              declineReason: chargeError.reason,
            }
          : { errorReason: chargeError.reason };

      // Persist the resolution, but the use case still failed — re-surface the
      // original charge error to the caller once the write is done (unless
      // persisting it failed too, which is a worse problem than the charge itself).
      const resolved = await this.resolve(pending, status, payment);
      return resolved.isOk() ? err(chargeError) : err(resolved.error);
    };

    return new ResultAsync(run());
  }

  private resolve(
    pending: Transaction,
    status: 'APPROVED' | 'DECLINED' | 'ERROR',
    payment: Parameters<TransactionRepository['updateResult']>[1]['payment'],
  ): ResultAsync<Transaction, CreateTransactionError> {
    return pending
      .transitionTo(status)
      .asyncAndThen(() => this.transactionRepository.updateResult(pending.id, { status, payment }));
  }
}
