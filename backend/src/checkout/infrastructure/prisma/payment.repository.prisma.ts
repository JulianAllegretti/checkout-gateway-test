import { Injectable } from '@nestjs/common';
import type { Payment as PaymentRow } from '@prisma/client';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { Payment } from '../../domain/entities';
import { RepositoryError } from '../../domain/errors';
import type { PaymentRepository } from '../../ports/outbound/payment.repository';
import { toRepositoryError } from './errors';
import { PrismaService } from './prisma.service';

function toDomain(row: PaymentRow): Payment {
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

@Injectable()
export class PaymentRepositoryPrisma implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTransactionId(transactionId: string): ResultAsync<Payment, RepositoryError> {
    return ResultAsync.fromPromise(this.prisma.payment.findUnique({ where: { transactionId } }), toRepositoryError).andThen((row) =>
      row ? okAsync(toDomain(row)) : errAsync(new RepositoryError(`Payment for transaction ${transactionId} not found`)),
    );
  }
}
