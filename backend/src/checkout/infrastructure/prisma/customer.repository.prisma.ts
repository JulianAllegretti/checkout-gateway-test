import { Injectable } from '@nestjs/common';
import type { Customer as CustomerRow } from '@prisma/client';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { Customer } from '../../domain/entities';
import { RepositoryError } from '../../domain/errors';
import type { CustomerRepository } from '../../ports/outbound/customer.repository';
import { toRepositoryError } from './errors';
import { PrismaService } from './prisma.service';

function toDomain(row: CustomerRow): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
  };
}

@Injectable()
export class CustomerRepositoryPrisma implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): ResultAsync<Customer, RepositoryError> {
    return ResultAsync.fromPromise(this.prisma.customer.findUnique({ where: { id } }), toRepositoryError).andThen((row) =>
      row ? okAsync(toDomain(row)) : errAsync(new RepositoryError(`Customer ${id} not found`)),
    );
  }
}
