import { Injectable } from '@nestjs/common';
import type { Delivery as DeliveryRow } from '@prisma/client';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { Delivery } from '../../domain/entities';
import { RepositoryError } from '../../domain/errors';
import type { DeliveryRepository } from '../../ports/outbound/delivery.repository';
import { toRepositoryError } from './errors';
import { PrismaService } from './prisma.service';

function toDomain(row: DeliveryRow): Delivery {
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

@Injectable()
export class DeliveryRepositoryPrisma implements DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTransactionId(transactionId: string): ResultAsync<Delivery, RepositoryError> {
    return ResultAsync.fromPromise(this.prisma.delivery.findUnique({ where: { transactionId } }), toRepositoryError).andThen((row) =>
      row ? okAsync(toDomain(row)) : errAsync(new RepositoryError(`Delivery for transaction ${transactionId} not found`)),
    );
  }
}
