import { Injectable } from '@nestjs/common';
import type {
  Customer as CustomerRow,
  Delivery as DeliveryRow,
  Payment as PaymentRow,
  Transaction as TransactionRow,
} from '@prisma/client';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import {
  Transaction,
  type Customer,
  type Delivery,
  type Payment,
  type TransactionDetail,
  type TransactionProps,
} from '../../domain/entities';
import { OutOfStock, ProductNotFound, RepositoryError, TransactionNotFound } from '../../domain/errors';
import type {
  NewTransactionData,
  TransactionRepository,
  TransactionResolution,
} from '../../ports/outbound/transaction.repository';
import { decimalToNumber } from './decimal';
import { toRepositoryError } from './errors';
import { PrismaService } from './prisma.service';

function toDomain(row: TransactionRow): Transaction {
  const props: TransactionProps = {
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    productId: row.productId,
    customerId: row.customerId,
    status: row.status,
    quantity: row.quantity,
    unitPriceAmount: row.unitPriceAmount,
    subtotalAmount: row.subtotalAmount,
    taxRate: decimalToNumber(row.taxRate),
    taxAmount: row.taxAmount,
    productAmount: row.productAmount,
    baseFeeAmount: row.baseFeeAmount,
    deliveryFeeAmount: row.deliveryFeeAmount,
    totalAmount: row.totalAmount,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return new Transaction(props);
}

function toCustomerDomain(row: CustomerRow): Customer {
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone };
}

function toDeliveryDomain(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    transactionId: row.transactionId,
    address: row.address,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    notes: row.notes,
  };
}

function toPaymentDomain(row: PaymentRow): Payment {
  return {
    id: row.id,
    transactionId: row.transactionId,
    cardLast4: row.cardLast4,
    cardBrand: row.cardBrand,
    gatewayReference: row.gatewayReference,
    declineReason: row.declineReason,
    errorReason: row.errorReason,
  };
}

// Prisma's `$transaction(async (tx) => ...)` rolls back on a thrown exception, not
// on a returned `Result.Err` — these are internal control-flow signals, caught right
// outside the transaction and converted into the real domain errors. They never
// escape this file (ADR 0001: "exceptions die at the boundary").
class ProductNotFoundSignal extends Error {
  constructor(readonly productId: string) {
    super('product not found');
  }
}

class OutOfStockSignal extends Error {
  constructor(
    readonly productId: string,
    readonly quantity: number,
  ) {
    super('out of stock');
  }
}

@Injectable()
export class TransactionRepositoryPrisma implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKey(key: string): ResultAsync<Transaction | null, RepositoryError> {
    return ResultAsync.fromPromise(
      this.prisma.transaction.findUnique({ where: { idempotencyKey: key } }),
      toRepositoryError,
    ).map((row) => (row ? toDomain(row) : null));
  }

  findById(id: string): ResultAsync<Transaction, TransactionNotFound> {
    return ResultAsync.fromPromise(
      this.prisma.transaction.findUnique({ where: { id } }),
      () => new TransactionNotFound(id),
    ).andThen((row) => (row ? okAsync(toDomain(row)) : errAsync(new TransactionNotFound(id))));
  }

  findByIdWithDetails(id: string): ResultAsync<TransactionDetail, TransactionNotFound> {
    return ResultAsync.fromPromise(
      this.prisma.transaction.findUnique({
        where: { id },
        include: { customer: true, delivery: true, payment: true },
      }),
      () => new TransactionNotFound(id),
    ).andThen((row) => {
      if (!row) return errAsync(new TransactionNotFound(id));
      return okAsync({
        transaction: toDomain(row),
        customer: toCustomerDomain(row.customer),
        // `delivery` is created atomically with the transaction in `createPending`
        // and never deleted — Prisma's back-relation type is nullable, reality isn't.
        delivery: toDeliveryDomain(row.delivery!),
        payment: row.payment ? toPaymentDomain(row.payment) : null,
      });
    });
  }

  createPending(data: NewTransactionData): ResultAsync<Transaction, OutOfStock | ProductNotFound | RepositoryError> {
    const run = this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new ProductNotFoundSignal(data.productId);

      const reserved = await tx.product.updateMany({
        where: { id: data.productId, stock: { gte: data.quantity } },
        data: { stock: { decrement: data.quantity } },
      });
      if (reserved.count === 0) throw new OutOfStockSignal(data.productId, data.quantity);

      // Find-or-create by email: `customers` is keyed by email (unique in the
      // schema), not re-created per purchase. Never updated on a match — there's
      // no auth here, so anyone typing a known email at checkout could otherwise
      // overwrite that person's stored name/phone. Stale contact info is the
      // safer failure mode than a spoofable one.
      const customer =
        (await tx.customer.findUnique({ where: { email: data.customer.email } })) ??
        (await tx.customer.create({ data: data.customer }));

      const transaction = await tx.transaction.create({
        data: {
          reference: data.reference,
          idempotencyKey: data.idempotencyKey,
          productId: data.productId,
          customerId: customer.id,
          quantity: data.quantity,
          unitPriceAmount: data.unitPriceAmount,
          subtotalAmount: data.subtotalAmount,
          taxRate: data.taxRate,
          taxAmount: data.taxAmount,
          productAmount: data.productAmount,
          baseFeeAmount: data.baseFeeAmount,
          deliveryFeeAmount: data.deliveryFeeAmount,
          totalAmount: data.totalAmount,
          currency: data.currency,
        },
      });

      await tx.delivery.create({
        data: {
          transactionId: transaction.id,
          address: data.delivery.address,
          city: data.delivery.city,
          region: data.delivery.region,
          postalCode: data.delivery.postalCode,
          notes: data.delivery.notes,
        },
      });

      return transaction;
    });

    return ResultAsync.fromPromise(run, (e) => {
      if (e instanceof ProductNotFoundSignal) return new ProductNotFound(e.productId);
      if (e instanceof OutOfStockSignal) return new OutOfStock(e.productId, e.quantity);
      return toRepositoryError(e);
    }).map(toDomain);
  }

  updateResult(id: string, resolution: TransactionResolution): ResultAsync<Transaction, RepositoryError> {
    const run = this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: resolution.status },
      });

      if (updated.count === 0) {
        // Already resolved by another process racing on the same transaction
        // (polling vs. webhook) — idempotent no-op, don't touch stock/payment again.
        return tx.transaction.findUniqueOrThrow({ where: { id } });
      }

      const current = await tx.transaction.findUniqueOrThrow({ where: { id } });

      if (resolution.status !== 'APPROVED') {
        await tx.product.update({
          where: { id: current.productId },
          data: { stock: { increment: current.quantity } },
        });
      }

      await tx.payment.upsert({
        where: { transactionId: id },
        create: { transactionId: id, ...resolution.payment },
        update: { ...resolution.payment },
      });

      return current;
    });

    return ResultAsync.fromPromise(run, toRepositoryError).map(toDomain);
  }
}
