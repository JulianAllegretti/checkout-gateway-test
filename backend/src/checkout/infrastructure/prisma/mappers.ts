import type {
  Customer as CustomerRow,
  Delivery as DeliveryRow,
  Payment as PaymentRow,
  Product as ProductRow,
  Transaction as TransactionRow,
} from '@prisma/client';
import {
  Transaction,
  type Customer,
  type Delivery,
  type Payment,
  type Product,
  type TransactionProps,
} from '../../domain/entities';
import { decimalToNumber } from './decimal';

export function productToDomain(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitPriceAmount: row.unitPriceAmount,
    taxRate: decimalToNumber(row.taxRate),
    stock: row.stock,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    currency: row.currency,
  };
}

export function customerToDomain(row: CustomerRow): Customer {
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone };
}

export function deliveryToDomain(row: DeliveryRow): Delivery {
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

export function paymentToDomain(row: PaymentRow): Payment {
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

export function transactionToDomain(row: TransactionRow): Transaction {
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
